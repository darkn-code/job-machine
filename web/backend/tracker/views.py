from datetime import timedelta

from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Count, Max, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from django_filters import rest_framework as df
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from . import serializers as s
from .models import CVGenerado, Empresa, Evento, Postulacion, Vacante


def actor_de(request):
    return request.user.username if request.user.is_authenticated else "anonimo"


# ---------------------------------------------------------------- auth / salud

@extend_schema(request=None, responses=None)
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"ok": True, "hora": timezone.now()})


@extend_schema(request=None, responses=None)
@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    user = authenticate(username=request.data.get("username"), password=request.data.get("password"))
    if not user:
        return Response({"detail": "Usuario o contraseña incorrectos."}, status=400)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "username": user.username})


@extend_schema(request=None, responses=None)
@api_view(["GET"])
def me(request):
    return Response({"username": request.user.username, "is_staff": request.user.is_staff})


# ---------------------------------------------------------------- empresas

class EmpresaViewSet(viewsets.ModelViewSet):
    serializer_class = s.EmpresaSerializer
    search_fields = ["nombre"]
    ordering_fields = ["nombre", "total_postulaciones", "ultima_postulacion"]

    def get_queryset(self):
        p = "vacantes__postulacion"
        return Empresa.objects.annotate(
            total_vacantes=Count("vacantes", distinct=True),
            total_postulaciones=Count(p, filter=Q(**{f"{p}__estado__in": Postulacion.ENVIADAS}), distinct=True),
            activas=Count(p, filter=Q(**{f"{p}__estado__in": Postulacion.ACTIVAS}), distinct=True),
            rechazadas=Count(p, filter=Q(**{f"{p}__estado": "rechazada"}), distinct=True),
            entrevistas=Count(p, filter=Q(**{f"{p}__estado__in": ["entrevista", "oferta"]}), distinct=True),
            ultima_postulacion=Max(f"{p}__fecha_envio"),
        )


# ---------------------------------------------------------------- vacantes

class VacanteFilter(df.FilterSet):
    empresa = df.CharFilter(field_name="empresa__nombre", lookup_expr="icontains")

    class Meta:
        model = Vacante
        fields = ["estado", "ats", "empresa", "prioridad"]


class VacanteViewSet(viewsets.ModelViewSet):
    queryset = Vacante.objects.select_related("empresa", "postulacion")
    serializer_class = s.VacanteSerializer
    filterset_class = VacanteFilter
    search_fields = ["puesto", "empresa__nombre", "descripcion", "url"]
    ordering_fields = ["fecha_detectada", "prioridad", "salario_max"]

    def create(self, request, *args, **kwargs):
        """Dedup por url: si ya existe, devuelve la existente con 200."""
        url = (request.data.get("url") or "").strip()
        if url:
            existente = self.get_queryset().filter(url=url).first()
            if existente:
                data = self.get_serializer(existente).data
                return Response({**data, "duplicada": True}, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)

    @extend_schema(
        parameters=[OpenApiParameter("limit", int, description="Máximo de vacantes (default 10)")],
        responses=s.VacantePendienteSerializer(many=True),
    )
    @action(detail=False, methods=["get"])
    def pendientes(self, request):
        """Vacantes aprobadas por DarkN (estado por_postular) para que el motor las procese."""
        try:
            limit = max(1, min(int(request.query_params.get("limit", 10)), 100))
        except ValueError:
            raise ValidationError({"limit": "Debe ser un entero."})
        qs = (
            Vacante.objects.select_related("empresa")
            .filter(estado=Vacante.Estado.POR_POSTULAR)
            .order_by("prioridad", "fecha_detectada")[:limit]
        )
        return Response(s.VacantePendienteSerializer(qs, many=True).data)

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    def aprobar(self, request, pk=None):
        vacante = self.get_object()
        vacante.estado = Vacante.Estado.POR_POSTULAR
        vacante.save(update_fields=["estado"])
        return Response(self.get_serializer(vacante).data)

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    def descartar(self, request, pk=None):
        vacante = self.get_object()
        vacante.estado = Vacante.Estado.DESCARTADA
        vacante.save(update_fields=["estado"])
        return Response(self.get_serializer(vacante).data)


# ---------------------------------------------------------------- postulaciones

class PostulacionFilter(df.FilterSet):
    estado = df.BaseInFilter(field_name="estado")  # ?estado=enviada,vista
    empresa = df.CharFilter(field_name="vacante__empresa__nombre", lookup_expr="icontains")
    empresa_id = df.NumberFilter(field_name="vacante__empresa_id")
    ats = df.CharFilter(field_name="vacante__ats")
    desde = df.DateTimeFilter(field_name="fecha_envio", lookup_expr="gte")
    hasta = df.DateTimeFilter(field_name="fecha_envio", lookup_expr="lte")

    class Meta:
        model = Postulacion
        fields = ["estado", "empresa", "empresa_id", "ats", "desde", "hasta"]


class PostulacionViewSet(viewsets.ModelViewSet):
    queryset = Postulacion.objects.select_related("vacante__empresa")
    filterset_class = PostulacionFilter
    search_fields = ["vacante__puesto", "vacante__empresa__nombre", "notas", "brechas"]
    ordering_fields = ["fecha_envio", "estado", "proximo_seguimiento", "actualizado", "vacante__salario_max"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return s.PostulacionDetalleSerializer
        if self.action == "registrar":
            return s.RegistroManualSerializer
        return s.PostulacionSerializer

    def create(self, request, *args, **kwargs):
        """Contrato POST /api/postulaciones: upsert por vacante_id (el motor puede reintentar)."""
        existente = Postulacion.objects.filter(vacante_id=request.data.get("vacante_id")).first()
        serializer = s.PostulacionSerializer(existente, data=request.data, partial=bool(existente))
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            post = serializer.instance or Postulacion(**serializer.validated_data)
            for campo, valor in serializer.validated_data.items():
                setattr(post, campo, valor)
            post._actor = actor_de(request)
            post.save()
            vacante = post.vacante
            if vacante.estado != Vacante.Estado.PROCESADA:
                vacante.estado = Vacante.Estado.PROCESADA
                vacante.save(update_fields=["estado"])
        return Response(
            s.PostulacionSerializer(post).data,
            status=status.HTTP_200_OK if existente else status.HTTP_201_CREATED,
        )

    def perform_update(self, serializer):
        serializer.instance._actor = actor_de(self.request)
        serializer.save()

    @action(detail=False, methods=["post"])
    def registrar(self, request):
        """Registra a mano una postulación (crea empresa/vacante si hace falta)."""
        ser = s.RegistroManualSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = dict(ser.validated_data)
        campos_post = ["estado", "fecha_envio", "notas", "brechas", "proxima_accion", "proximo_seguimiento"]
        datos_post = {k: d.pop(k) for k in campos_post if k in d}
        empresa = s.EmpresaField().to_internal_value(d.pop("empresa"))
        url = (d.pop("url", None) or "").strip() or None
        with transaction.atomic():
            vacante = Vacante.objects.filter(url=url).first() if url else None
            if vacante is None:
                vacante = Vacante.objects.create(
                    empresa=empresa, url=url, estado=Vacante.Estado.PROCESADA, **d
                )
            if hasattr(vacante, "postulacion"):
                raise ValidationError({"url": "Ya existe una postulación para esta vacante."})
            post = Postulacion(vacante=vacante, **datos_post)
            post._actor = actor_de(request)
            post.save()
        return Response(s.PostulacionSerializer(post).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------- eventos

class EventoViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                    mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = Evento.objects.select_related("postulacion__vacante__empresa")
    serializer_class = s.EventoSerializer
    filterset_fields = ["tipo", "postulacion", "actor"]
    search_fields = ["titulo", "contenido", "remitente"]

    def _resolver_postulacion(self, d):
        if d.get("postulacion_id"):
            return Postulacion.objects.filter(pk=d["postulacion_id"]).first()
        if d.get("vacante_id"):
            return Postulacion.objects.filter(vacante_id=d["vacante_id"]).first()
        if d.get("url"):
            return Postulacion.objects.filter(vacante__url=d["url"]).first()
        if d.get("empresa_nombre"):
            # La más reciente de esa empresa (lo típico al leer un correo: solo sabes la empresa).
            return (
                Postulacion.objects.filter(vacante__empresa__nombre__iexact=d["empresa_nombre"].strip())
                .order_by("-fecha_envio", "-creado").first()
            )
        return None

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = dict(ser.validated_data)
        post = self._resolver_postulacion(d)
        if post is None:
            raise ValidationError(
                {"postulacion": "No encontré la postulación. Manda postulacion_id, vacante_id, url o empresa_nombre."}
            )
        nuevo_estado = d.pop("cambiar_estado", None)
        for k in ["postulacion_id", "vacante_id", "url", "empresa_nombre"]:
            d.pop(k, None)
        actor = actor_de(request)
        with transaction.atomic():
            evento = Evento.objects.create(postulacion=post, actor=actor, **d)
            if nuevo_estado and nuevo_estado != post.estado:
                evento.estado_anterior, evento.estado_nuevo = post.estado, nuevo_estado
                evento.save(update_fields=["estado_anterior", "estado_nuevo"])
                post.estado = nuevo_estado
                post._actor = actor
                post.save()
        return Response(self.get_serializer(evento).data, status=status.HTTP_201_CREATED)


class CVGeneradoViewSet(viewsets.ModelViewSet):
    queryset = CVGenerado.objects.all()
    serializer_class = s.CVGeneradoSerializer
    filterset_fields = ["vacante"]


# ---------------------------------------------------------------- stats para el dashboard

@extend_schema(request=None, responses=None)
@api_view(["GET"])
def stats(request):
    ahora = timezone.now()
    hoy = timezone.localdate()
    posts = Postulacion.objects.all()
    enviadas = posts.filter(estado__in=Postulacion.ENVIADAS)
    n_enviadas = enviadas.count()
    n_respuesta = posts.filter(estado__in=Postulacion.CON_RESPUESTA).count()

    por_estado = {e: 0 for e, _ in Postulacion.Estado.choices}
    for row in posts.values("estado").annotate(n=Count("id")):
        por_estado[row["estado"]] = row["n"]

    # Serie diaria de los últimos 30 días (con ceros) para la gráfica.
    inicio = hoy - timedelta(days=29)
    conteo = {
        r["dia"]: r["n"]
        for r in enviadas.filter(fecha_envio__date__gte=inicio)
        .annotate(dia=TruncDate("fecha_envio")).values("dia").annotate(n=Count("id"))
    }
    por_dia = [
        {"fecha": (inicio + timedelta(days=i)).isoformat(), "enviadas": conteo.get(inicio + timedelta(days=i), 0)}
        for i in range(30)
    ]

    por_ats = list(
        posts.exclude(estado="por_postular").values("vacante__ats").annotate(n=Count("id")).order_by("-n")
    )
    por_empresa = list(
        enviadas.values("vacante__empresa__nombre").annotate(n=Count("id")).order_by("-n", "vacante__empresa__nombre")[:8]
    )

    seguimientos = (
        posts.filter(estado__in=Postulacion.ACTIVAS, proximo_seguimiento__isnull=False,
                     proximo_seguimiento__date__lte=hoy + timedelta(days=3))
        .select_related("vacante__empresa").order_by("proximo_seguimiento")[:10]
    )

    return Response({
        "kpis": {
            "total": posts.count(),
            "enviadas": n_enviadas,
            "semana": enviadas.filter(fecha_envio__gte=ahora - timedelta(days=7)).count(),
            "en_proceso": posts.filter(estado__in=["enviada", "vista"]).count(),
            "entrevistas": por_estado["entrevista"],
            "ofertas": por_estado["oferta"],
            "rechazadas": por_estado["rechazada"],
            "captchas": por_estado["captcha_pendiente"],
            "errores": por_estado["error"],
            "tasa_respuesta": round(100 * n_respuesta / n_enviadas, 1) if n_enviadas else 0,
            "vacantes_por_revisar": Vacante.objects.filter(estado=Vacante.Estado.NUEVA).count(),
            "vacantes_en_cola": Vacante.objects.filter(estado=Vacante.Estado.POR_POSTULAR).count(),
            "empresas": Empresa.objects.count(),
        },
        "por_estado": por_estado,
        "por_dia": por_dia,
        "por_ats": [{"ats": r["vacante__ats"], "n": r["n"]} for r in por_ats],
        "por_empresa": [{"empresa": r["vacante__empresa__nombre"], "n": r["n"]} for r in por_empresa],
        "seguimientos": s.PostulacionSerializer(seguimientos, many=True).data,
        "actividad": s.EventoSerializer(
            Evento.objects.select_related("postulacion__vacante__empresa")[:12], many=True
        ).data,
    })
