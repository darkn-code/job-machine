from rest_framework import serializers

from .models import CVGenerado, Empresa, Evento, Postulacion, Vacante


class EmpresaField(serializers.Field):
    """La empresa viaja como texto (nombre) en el contrato; se crea si no existe."""

    def to_representation(self, value):
        return value.nombre

    def to_internal_value(self, data):
        nombre = str(data).strip()
        if not nombre:
            raise serializers.ValidationError("La empresa es obligatoria.")
        empresa = Empresa.objects.filter(nombre__iexact=nombre).first()
        return empresa or Empresa.objects.create(nombre=nombre)


class EmpresaSerializer(serializers.ModelSerializer):
    total_vacantes = serializers.IntegerField(read_only=True, default=0)
    total_postulaciones = serializers.IntegerField(read_only=True, default=0)
    activas = serializers.IntegerField(read_only=True, default=0)
    rechazadas = serializers.IntegerField(read_only=True, default=0)
    entrevistas = serializers.IntegerField(read_only=True, default=0)
    ultima_postulacion = serializers.DateTimeField(read_only=True, default=None)

    class Meta:
        model = Empresa
        fields = [
            "id", "nombre", "web", "notas", "creado", "total_vacantes", "total_postulaciones",
            "activas", "rechazadas", "entrevistas", "ultima_postulacion",
        ]


class PostulacionMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Postulacion
        fields = ["id", "estado", "fecha_envio"]


class VacanteSerializer(serializers.ModelSerializer):
    empresa = EmpresaField()
    empresa_id = serializers.IntegerField(source="empresa.id", read_only=True)
    postulacion = PostulacionMiniSerializer(read_only=True)

    class Meta:
        model = Vacante
        fields = [
            "id", "empresa", "empresa_id", "puesto", "url", "ats", "descripcion", "salario_min",
            "salario_max", "moneda", "modalidad", "contrato", "fuente", "keywords", "prioridad",
            "estado", "fecha_detectada", "postulacion",
        ]
        # La dedup por url la hace la vista (devuelve la existente), no un error de validación.
        extra_kwargs = {"url": {"validators": []}}


class VacantePendienteSerializer(serializers.ModelSerializer):
    """Forma exacta de GET /api/vacantes/pendientes (INTEGRATION.md)."""

    empresa = serializers.CharField(source="empresa.nombre")

    class Meta:
        model = Vacante
        fields = [
            "id", "empresa", "puesto", "url", "ats", "descripcion", "salario_min", "salario_max",
            "moneda", "modalidad",
        ]


class VacanteMiniSerializer(serializers.ModelSerializer):
    empresa = serializers.CharField(source="empresa.nombre")
    empresa_id = serializers.IntegerField(source="empresa.id")

    class Meta:
        model = Vacante
        fields = [
            "id", "empresa", "empresa_id", "puesto", "url", "ats", "salario_min", "salario_max",
            "moneda", "modalidad", "contrato", "fuente", "prioridad",
        ]


class PostulacionSerializer(serializers.ModelSerializer):
    vacante = VacanteMiniSerializer(read_only=True)
    vacante_id = serializers.PrimaryKeyRelatedField(
        source="vacante", queryset=Vacante.objects.all(), write_only=True
    )

    class Meta:
        model = Postulacion
        fields = [
            "id", "vacante", "vacante_id", "estado", "fecha_envio", "cv_pdf", "keywords_usadas",
            "captcha_link", "screenshot", "notas", "brechas", "proxima_accion",
            "proximo_seguimiento", "creado", "actualizado",
        ]
        # vacante_id es "upsert" en la vista: no validar unicidad aquí.
        validators = []


class PostulacionDetalleSerializer(PostulacionSerializer):
    descripcion = serializers.CharField(source="vacante.descripcion", read_only=True)
    eventos = serializers.SerializerMethodField()

    class Meta(PostulacionSerializer.Meta):
        fields = PostulacionSerializer.Meta.fields + ["descripcion", "eventos"]

    def get_eventos(self, obj):
        return EventoSerializer(obj.eventos.all(), many=True).data


class RegistroManualSerializer(serializers.Serializer):
    """Para registrar desde el panel una postulación hecha a mano (vacante + postulación juntas)."""

    empresa = serializers.CharField()
    puesto = serializers.CharField()
    url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    ats = serializers.ChoiceField(choices=Vacante.ATS.choices, required=False)
    descripcion = serializers.CharField(required=False, allow_blank=True)
    salario_min = serializers.IntegerField(required=False, allow_null=True)
    salario_max = serializers.IntegerField(required=False, allow_null=True)
    moneda = serializers.CharField(required=False, allow_blank=True)
    modalidad = serializers.CharField(required=False, allow_blank=True)
    contrato = serializers.CharField(required=False, allow_blank=True)
    fuente = serializers.CharField(required=False, allow_blank=True)
    estado = serializers.ChoiceField(choices=Postulacion.Estado.choices, default="enviada")
    fecha_envio = serializers.DateTimeField(required=False, allow_null=True)
    notas = serializers.CharField(required=False, allow_blank=True)
    brechas = serializers.CharField(required=False, allow_blank=True)
    proxima_accion = serializers.CharField(required=False, allow_blank=True)
    proximo_seguimiento = serializers.DateTimeField(required=False, allow_null=True)


class EventoSerializer(serializers.ModelSerializer):
    # Formas de identificar la postulación (el bot usa la que tenga a mano).
    postulacion_id = serializers.IntegerField(required=False, write_only=True)
    vacante_id = serializers.IntegerField(required=False, write_only=True)
    url = serializers.CharField(required=False, write_only=True)
    empresa_nombre = serializers.CharField(required=False, write_only=True)
    cambiar_estado = serializers.ChoiceField(
        choices=Postulacion.Estado.choices, required=False, write_only=True,
        help_text="Si se manda, la postulación pasa a este estado.",
    )

    postulacion = serializers.IntegerField(source="postulacion.id", read_only=True)
    empresa = serializers.CharField(source="postulacion.vacante.empresa.nombre", read_only=True)
    puesto = serializers.CharField(source="postulacion.vacante.puesto", read_only=True)

    class Meta:
        model = Evento
        fields = [
            "id", "postulacion", "empresa", "puesto", "tipo", "titulo", "remitente", "contenido",
            "estado_anterior", "estado_nuevo", "actor", "fecha",
            "postulacion_id", "vacante_id", "url", "empresa_nombre", "cambiar_estado",
        ]
        read_only_fields = ["estado_anterior", "estado_nuevo", "actor"]


class CVGeneradoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CVGenerado
        fields = ["id", "vacante", "ruta_pdf", "keywords_usadas", "fecha"]
