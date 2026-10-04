"""Tests del contrato con el motor (docs/INTEGRATION.md). Si estos fallan, se rompe GabyBot."""
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Empresa, Evento, Postulacion, Vacante


class ContratoMotorTests(APITestCase):
    def setUp(self):
        bot = User.objects.create(username="gabybot")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=bot).key}")
        self.acme = Empresa.objects.create(nombre="Acme Corp")

    def vacante(self, **kw):
        datos = dict(empresa=self.acme, puesto="Backend Engineer", url="https://jobs.ashbyhq.com/acme/1")
        datos.update(kw)
        return Vacante.objects.create(**datos)

    def test_sin_token_401(self):
        self.client.credentials()
        self.assertEqual(self.client.get("/api/vacantes/pendientes").status_code, 401)

    def test_pendientes_solo_aprobadas(self):
        self.vacante(estado="nueva")
        v = self.vacante(url="https://jobs.lever.co/acme/2", estado="por_postular")
        r = self.client.get("/api/vacantes/pendientes?limit=5")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([x["id"] for x in r.json()], [v.id])
        self.assertEqual(r.json()[0]["empresa"], "Acme Corp")
        self.assertEqual(r.json()[0]["ats"], "lever")  # detectado por dominio
        self.assertEqual(
            set(r.json()[0]),
            {"id", "empresa", "puesto", "url", "ats", "descripcion", "salario_min", "salario_max", "moneda", "modalidad"},
        )

    def test_post_vacante_dedup_por_url(self):
        body = {"empresa": "Nueva SA", "puesto": "Python Dev", "url": "https://boards.greenhouse.io/x/1"}
        r1 = self.client.post("/api/vacantes", body, format="json")
        r2 = self.client.post("/api/vacantes", body, format="json")
        self.assertEqual((r1.status_code, r2.status_code), (201, 200))
        self.assertTrue(r2.json()["duplicada"])
        self.assertEqual(r1.json()["estado"], "nueva")  # requiere OK de DarkN
        self.assertEqual(r1.json()["ats"], "greenhouse")
        self.assertEqual(Vacante.objects.filter(url=body["url"]).count(), 1)

    def test_post_postulacion_upsert_y_marca_vacante(self):
        v = self.vacante(estado="por_postular")
        body = {
            "vacante_id": v.id, "estado": "captcha_pendiente", "cv_pdf": "data/cv/acme_1.pdf",
            "keywords_usadas": ["python", "docker"], "captcha_link": "https://x/1",
            "screenshot": None, "notas": "hay captcha", "fecha_envio": None,
        }
        r = self.client.post("/api/postulaciones", body, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        pid = r.json()["id"]
        v.refresh_from_db()
        self.assertEqual(v.estado, "procesada")
        self.assertFalse(self.client.get("/api/vacantes/pendientes").json())

        # Reintento del motor: misma vacante -> actualiza, no duplica.
        r = self.client.post("/api/postulaciones", {"vacante_id": v.id, "estado": "enviada"}, format="json")
        self.assertEqual((r.status_code, r.json()["id"]), (200, pid))
        p = Postulacion.objects.get(pk=pid)
        self.assertEqual(p.estado, "enviada")
        self.assertIsNotNone(p.fecha_envio)
        self.assertEqual(p.eventos.filter(tipo="cambio_estado").count(), 2)
        self.assertEqual(p.eventos.first().actor, "gabybot")

    def test_patch_postulacion(self):
        p = Postulacion.objects.create(vacante=self.vacante(), estado="enviada")
        r = self.client.patch(f"/api/postulaciones/{p.id}", {"estado": "entrevista"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["estado"], "entrevista")

    def test_evento_correo_por_empresa_cambia_estado(self):
        p = Postulacion.objects.create(vacante=self.vacante(), estado="enviada")
        r = self.client.post("/api/eventos", {
            "empresa_nombre": "acme corp", "tipo": "correo_recibido", "titulo": "Next steps",
            "remitente": "hr@acme.com", "contenido": "We'd like to schedule an interview",
            "cambiar_estado": "entrevista",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["estado_nuevo"], "entrevista")
        p.refresh_from_db()
        self.assertEqual(p.estado, "entrevista")
        self.assertTrue(Evento.objects.filter(postulacion=p, tipo="correo_recibido").exists())

    def test_evento_sin_postulacion_400(self):
        r = self.client.post("/api/eventos", {"empresa_nombre": "No existe", "titulo": "x"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_registrar_manual_y_stats(self):
        r = self.client.post("/api/postulaciones/registrar", {
            "empresa": "Hecha a mano", "puesto": "Dev", "url": "https://jobs.ashbyhq.com/m/1",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        stats = self.client.get("/api/stats").json()
        self.assertEqual(stats["kpis"]["enviadas"], 1)
        self.assertEqual(len(stats["por_dia"]), 30)
        self.assertEqual(stats["por_dia"][-1]["enviadas"], 1)
