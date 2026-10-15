import math

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


class HabilidadField(serializers.CharField):
    def to_internal_value(self, data):
        if not isinstance(data, str):
            raise serializers.ValidationError("Cada habilidad debe ser texto.")
        return super().to_internal_value(data)


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
    match_porcentaje = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=100)
    habilidades_coincidentes = serializers.ListField(
        child=HabilidadField(allow_blank=False, trim_whitespace=True), required=False
    )
    habilidades_faltantes = serializers.ListField(
        child=HabilidadField(allow_blank=False, trim_whitespace=True), required=False
    )

    def validate_match_porcentaje(self, value):
        if value is not None and not math.isfinite(value):
            raise serializers.ValidationError("Debe ser un número finito entre 0 y 100.")
        return value

    def validate(self, attrs):
        def normalize(items):
            seen = set()
            result = []
            for item in items:
                label = " ".join(item.split())
                key = label.casefold()
                if not label or key in seen:
                    raise serializers.ValidationError("Cada habilidad debe tener texto y ser única en su lista.")
                seen.add(key)
                result.append(label)
            return result, seen

        for field in ("habilidades_coincidentes", "habilidades_faltantes"):
            if field in attrs:
                attrs[field], _ = normalize(attrs[field])
        matched = attrs.get("habilidades_coincidentes", getattr(self.instance, "habilidades_coincidentes", []))
        missing = attrs.get("habilidades_faltantes", getattr(self.instance, "habilidades_faltantes", []))
        _, matched_keys = normalize(matched)
        _, missing_keys = normalize(missing)
        if matched_keys & missing_keys:
            raise serializers.ValidationError({"habilidades_faltantes": "Una habilidad no puede estar también en coincidencias."})
        return attrs

    class Meta:
        model = Postulacion
        fields = [
            "id", "vacante", "vacante_id", "estado", "fecha_envio", "cv_pdf", "keywords_usadas",
            "captcha_link", "screenshot", "notas", "brechas", "match_porcentaje",
            "habilidades_coincidentes", "habilidades_faltantes", "match_notas", "proxima_accion",
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


class HabilidadFrecuenciaSerializer(serializers.Serializer):
    habilidad = serializers.CharField()
    total = serializers.IntegerField()
    faltantes = serializers.IntegerField()
    coincidentes = serializers.IntegerField()
    postulacion_ids = serializers.ListField(child=serializers.IntegerField())


class HabilidadesResumenSerializer(serializers.Serializer):
    total_postulaciones = serializers.IntegerField()
    evaluadas = serializers.IntegerField()
    match_promedio = serializers.FloatField(allow_null=True)
    habilidades = HabilidadFrecuenciaSerializer(many=True)


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
    match_porcentaje = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=100)
    habilidades_coincidentes = serializers.ListField(child=HabilidadField(allow_blank=False), required=False)
    habilidades_faltantes = serializers.ListField(child=HabilidadField(allow_blank=False), required=False)
    match_notas = serializers.CharField(required=False, allow_blank=True)
    proxima_accion = serializers.CharField(required=False, allow_blank=True)
    proximo_seguimiento = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        match_fields = {k: v for k, v in attrs.items() if k in (
            "match_porcentaje", "habilidades_coincidentes", "habilidades_faltantes", "match_notas"
        )}
        validated = PostulacionSerializer().validate(match_fields)
        attrs.update(validated)
        score = attrs.get("match_porcentaje")
        if score is not None and not math.isfinite(score):
            raise serializers.ValidationError({"match_porcentaje": "Debe ser un número finito entre 0 y 100."})
        return attrs


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
