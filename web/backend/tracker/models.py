"""Modelos del tracker. Campos alineados con docs/INTEGRATION.md (contrato con el motor)."""
from urllib.parse import urlparse

from django.db import models
from django.utils import timezone


class Empresa(models.Model):
    nombre = models.CharField(max_length=200, unique=True)
    web = models.URLField(blank=True)
    notas = models.TextField(blank=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Vacante(models.Model):
    class ATS(models.TextChoices):
        ASHBY = "ashby", "Ashby"
        GREENHOUSE = "greenhouse", "Greenhouse"
        LEVER = "lever", "Lever"
        JAZZHR = "jazzhr", "JazzHR"
        WORKDAY = "workday", "Workday"
        GETONBRD = "getonbrd", "Get on Board"
        LINKEDIN = "linkedin", "LinkedIn"
        GENERICO = "generico", "Genérico"

    class Estado(models.TextChoices):
        # Regla dura: el motor solo toma las que DarkN aprobó (por_postular).
        NUEVA = "nueva", "Por revisar"
        POR_POSTULAR = "por_postular", "Aprobada / por postular"
        PROCESADA = "procesada", "Procesada"
        DESCARTADA = "descartada", "Descartada"

    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name="vacantes")
    puesto = models.CharField(max_length=300)
    url = models.CharField(max_length=1000, unique=True, null=True, blank=True)
    ats = models.CharField(max_length=20, choices=ATS.choices, default=ATS.GENERICO)
    descripcion = models.TextField(blank=True)
    salario_min = models.IntegerField(null=True, blank=True)
    salario_max = models.IntegerField(null=True, blank=True)
    moneda = models.CharField(max_length=50, blank=True)
    modalidad = models.CharField(max_length=120, blank=True)
    contrato = models.CharField(max_length=200, blank=True)
    fuente = models.CharField(max_length=200, blank=True)
    keywords = models.JSONField(default=list, blank=True)
    prioridad = models.PositiveSmallIntegerField(default=3)  # 1 = máxima, 5 = mínima
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.NUEVA)
    fecha_detectada = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-fecha_detectada"]

    def __str__(self):
        return f"{self.puesto} @ {self.empresa}"

    def save(self, *args, **kwargs):
        if self.url == "":
            self.url = None
        if self.url and self.ats == self.ATS.GENERICO:
            self.ats = detect_ats(self.url)
        super().save(*args, **kwargs)


ATS_DOMINIOS = [
    ("ashbyhq.com", Vacante.ATS.ASHBY),
    ("greenhouse.io", Vacante.ATS.GREENHOUSE),
    ("lever.co", Vacante.ATS.LEVER),
    ("applytojob.com", Vacante.ATS.JAZZHR),
    ("myworkdayjobs.com", Vacante.ATS.WORKDAY),
    ("getonbrd.com", Vacante.ATS.GETONBRD),
    ("linkedin.com", Vacante.ATS.LINKEDIN),
]


def detect_ats(url):
    host = urlparse(url).netloc.lower()
    for dominio, ats in ATS_DOMINIOS:
        if host.endswith(dominio):
            return ats
    return Vacante.ATS.GENERICO


class Postulacion(models.Model):
    class Estado(models.TextChoices):
        POR_POSTULAR = "por_postular", "Por postular"
        ENVIADA = "enviada", "Enviada"
        CAPTCHA_PENDIENTE = "captcha_pendiente", "Captcha pendiente"
        ERROR = "error", "Error"
        SALTADA = "saltada", "Saltada"
        VISTA = "vista", "Vista por la empresa"
        ENTREVISTA = "entrevista", "Entrevista"
        OFERTA = "oferta", "Oferta"
        RECHAZADA = "rechazada", "Rechazada"

    # Estados que cuentan como "ya salió la postulación".
    ENVIADAS = [Estado.ENVIADA, Estado.VISTA, Estado.ENTREVISTA, Estado.OFERTA, Estado.RECHAZADA]
    # Estados que cuentan como "la empresa respondió".
    CON_RESPUESTA = [Estado.VISTA, Estado.ENTREVISTA, Estado.OFERTA, Estado.RECHAZADA]
    ACTIVAS = [Estado.ENVIADA, Estado.VISTA, Estado.ENTREVISTA, Estado.OFERTA, Estado.CAPTCHA_PENDIENTE]

    vacante = models.OneToOneField(Vacante, on_delete=models.CASCADE, related_name="postulacion")
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.POR_POSTULAR)
    fecha_envio = models.DateTimeField(null=True, blank=True)
    cv_pdf = models.CharField(max_length=500, blank=True)
    keywords_usadas = models.JSONField(default=list, blank=True)
    captcha_link = models.CharField(max_length=1000, null=True, blank=True)
    screenshot = models.CharField(max_length=500, null=True, blank=True)
    notas = models.TextField(blank=True)
    brechas = models.TextField(blank=True)
    proxima_accion = models.CharField(max_length=300, blank=True)
    proximo_seguimiento = models.DateTimeField(null=True, blank=True)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha_envio", "-creado"]
        verbose_name_plural = "postulaciones"

    def __str__(self):
        return f"{self.vacante} [{self.estado}]"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._estado_original = self.estado

    def save(self, *args, **kwargs):
        # Quien hace el cambio (usuario/bot) se pasa poniendo `instance._actor` antes de guardar.
        actor = getattr(self, "_actor", "sistema")
        es_nueva = self.pk is None
        if self.estado == self.Estado.ENVIADA and not self.fecha_envio:
            self.fecha_envio = timezone.now()
        super().save(*args, **kwargs)
        if es_nueva or self.estado != self._estado_original:
            Evento.objects.create(
                postulacion=self,
                tipo=Evento.Tipo.CAMBIO_ESTADO,
                titulo=("Creada como " if es_nueva else "Estado → ") + self.get_estado_display(),
                estado_anterior="" if es_nueva else self._estado_original,
                estado_nuevo=self.estado,
                actor=actor,
            )
            self._estado_original = self.estado


class Evento(models.Model):
    """Línea de tiempo de una postulación: correos, cambios de estado, notas."""

    class Tipo(models.TextChoices):
        CORREO_RECIBIDO = "correo_recibido", "Correo recibido"
        CORREO_ENVIADO = "correo_enviado", "Correo enviado"
        CAMBIO_ESTADO = "cambio_estado", "Cambio de estado"
        ENTREVISTA = "entrevista", "Entrevista agendada"
        NOTA = "nota", "Nota"

    postulacion = models.ForeignKey(Postulacion, on_delete=models.CASCADE, related_name="eventos")
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.NOTA)
    titulo = models.CharField(max_length=300, blank=True)
    remitente = models.CharField(max_length=300, blank=True)
    contenido = models.TextField(blank=True)
    estado_anterior = models.CharField(max_length=20, blank=True)
    estado_nuevo = models.CharField(max_length=20, blank=True)
    actor = models.CharField(max_length=100, default="sistema")
    fecha = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"{self.get_tipo_display()}: {self.titulo}"


class CVGenerado(models.Model):
    vacante = models.ForeignKey(Vacante, on_delete=models.CASCADE, related_name="cvs")
    ruta_pdf = models.CharField(max_length=500)
    keywords_usadas = models.JSONField(default=list, blank=True)
    fecha = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-fecha"]
        verbose_name = "CV generado"
        verbose_name_plural = "CVs generados"
