from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views


router = DefaultRouter()
# Acepta con y sin slash final: /api/postulaciones y /api/postulaciones/
router.trailing_slash = "/?"
router.register("empresas", views.EmpresaViewSet, basename="empresa")
router.register("vacantes", views.VacanteViewSet, basename="vacante")
router.register("postulaciones", views.PostulacionViewSet, basename="postulacion")
router.register("eventos", views.EventoViewSet, basename="evento")
router.register("cvs", views.CVGeneradoViewSet, basename="cv")

urlpatterns = [
    path("health", views.health),
    path("auth/login", views.login),
    path("auth/me", views.me),
    path("stats", views.stats),
] + router.urls
