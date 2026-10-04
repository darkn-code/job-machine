"""Crea (o muestra) el usuario del bot y su token de API."""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from rest_framework.authtoken.models import Token


class Command(BaseCommand):
    help = "Crea el usuario del bot (default: gabybot) y muestra su token. --rotar genera uno nuevo."

    def add_arguments(self, parser):
        parser.add_argument("--usuario", default="gabybot")
        parser.add_argument("--rotar", action="store_true", help="Invalida el token anterior.")

    def handle(self, *args, **opts):
        user, creado = get_user_model().objects.get_or_create(username=opts["usuario"])
        if creado:
            user.set_unusable_password()  # el bot solo entra por token
            user.save()
        if opts["rotar"]:
            Token.objects.filter(user=user).delete()
        token, _ = Token.objects.get_or_create(user=user)
        self.stdout.write(f"Usuario: {user.username}")
        self.stdout.write(self.style.SUCCESS(f"Token:   {token.key}"))
