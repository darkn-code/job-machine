"""Carga el historial inicial (migrado del Excel de seguimiento). Idempotente."""
import json
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone

from tracker.models import Empresa, Evento, Postulacion, Vacante

SEED = Path(__file__).resolve().parents[2] / "seed" / "postulaciones.json"


def fecha(valor):
    if not valor:
        return None
    return timezone.make_aware(datetime.fromisoformat(valor))


class Command(BaseCommand):
    help = "Carga las postulaciones iniciales desde tracker/seed/postulaciones.json"

    def add_arguments(self, parser):
        parser.add_argument("--archivo", default=str(SEED))

    def handle(self, *args, **opts):
        archivo = Path(opts["archivo"])
        if not archivo.exists():
            self.stdout.write(self.style.WARNING(f"No existe {archivo}; nada que cargar."))
            return
        creadas = 0
        for row in json.loads(archivo.read_text(encoding="utf-8")):
            empresa, _ = Empresa.objects.get_or_create(nombre=row["empresa"])
            existe = Vacante.objects.filter(url=row["url"]).exists() if row.get("url") else \
                Vacante.objects.filter(empresa=empresa, puesto=row["puesto"]).exists()
            if existe:
                continue
            envio = fecha(row.get("fecha_envio"))
            vacante = Vacante.objects.create(
                empresa=empresa, puesto=row["puesto"], url=row.get("url"),
                salario_min=row.get("salario_min"), salario_max=row.get("salario_max"),
                moneda=row.get("moneda", ""), modalidad=row.get("modalidad", ""),
                contrato=row.get("contrato", ""), fuente=row.get("fuente", ""),
                estado=Vacante.Estado.PROCESADA, fecha_detectada=envio or timezone.now(),
            )
            post = Postulacion(
                vacante=vacante, estado="enviada", fecha_envio=envio,
                notas=f"[{row['ref']}] {row.get('notas', '')}".strip(), brechas=row.get("brechas", ""),
                proxima_accion=row.get("proxima_accion", ""),
                proximo_seguimiento=fecha(row.get("proximo_seguimiento")),
            )
            post._actor = "seed"
            post.save()
            post.eventos.update(fecha=envio or timezone.now(), titulo="Postulación enviada")
            if row["estado"] != "enviada":
                post.estado = row["estado"]
                post._actor = "seed"
                post.save()
            creadas += 1
        self.stdout.write(self.style.SUCCESS(f"Seed listo: {creadas} postulaciones nuevas."))
