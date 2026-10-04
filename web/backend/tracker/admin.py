from django.contrib import admin

from .models import CVGenerado, Empresa, Evento, Postulacion, Vacante


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    search_fields = ["nombre"]


@admin.register(Vacante)
class VacanteAdmin(admin.ModelAdmin):
    list_display = ["puesto", "empresa", "ats", "estado", "prioridad", "fecha_detectada"]
    list_filter = ["estado", "ats"]
    search_fields = ["puesto", "empresa__nombre", "url"]


class EventoInline(admin.TabularInline):
    model = Evento
    extra = 0


@admin.register(Postulacion)
class PostulacionAdmin(admin.ModelAdmin):
    list_display = ["vacante", "estado", "fecha_envio", "proximo_seguimiento"]
    list_filter = ["estado"]
    search_fields = ["vacante__puesto", "vacante__empresa__nombre"]
    inlines = [EventoInline]


@admin.register(Evento)
class EventoAdmin(admin.ModelAdmin):
    list_display = ["fecha", "tipo", "titulo", "postulacion", "actor"]
    list_filter = ["tipo", "actor"]


admin.site.register(CVGenerado)
