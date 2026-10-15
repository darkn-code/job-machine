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

    def test_match_creacion_patch_upsert_y_registro_manual(self):
        v = self.vacante()
        first = self.client.post("/api/postulaciones", {
            "vacante_id": v.id, "match_porcentaje": 72.5,
            "habilidades_coincidentes": [" Python ", "C++"],
            "habilidades_faltantes": ["AWS"], "match_notas": "Revisión manual",
        }, format="json")
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(first.json()["habilidades_coincidentes"], ["Python", "C++"])
        pid = first.json()["id"]
        patched = self.client.patch(f"/api/postulaciones/{pid}", {
            "match_porcentaje": 85, "habilidades_faltantes": ["Azure"]
        }, format="json")
        self.assertEqual(patched.status_code, 200, patched.content)
        self.client.post("/api/postulaciones", {"vacante_id": v.id, "estado": "enviada"}, format="json")
        post = Postulacion.objects.get(pk=pid)
        self.assertEqual(post.match_porcentaje, 85)
        self.assertEqual(post.habilidades_coincidentes, ["Python", "C++"])
        self.assertEqual(post.habilidades_faltantes, ["Azure"])
        manual = self.client.post("/api/postulaciones/registrar", {
            "empresa": "Manual", "puesto": "Dev", "match_porcentaje": 60,
            "habilidades_faltantes": [" Go "]
        }, format="json")
        self.assertEqual(manual.status_code, 201, manual.content)
        self.assertEqual(manual.json()["habilidades_faltantes"], ["Go"])

    def test_match_validacion_y_auth(self):
        p = Postulacion.objects.create(vacante=self.vacante())
        for payload in (
            {"match_porcentaje": -1}, {"match_porcentaje": 101},
            {"habilidades_faltantes": "Python"},
            {"habilidades_faltantes": [42]},
            {"habilidades_faltantes": ["  "]},
            {"habilidades_faltantes": ["C#", " c# "]},
            {"habilidades_coincidentes": [" AWS "], "habilidades_faltantes": ["aws"]},
        ):
            response = self.client.patch(f"/api/postulaciones/{p.id}", payload, format="json")
            self.assertEqual(response.status_code, 400, (payload, response.content))
        self.assertEqual(self.client.patch(f"/api/postulaciones/{p.id}", {
            "habilidades_coincidentes": ["C++"]
        }, format="json").status_code, 200)
        self.assertEqual(self.client.patch(f"/api/postulaciones/{p.id}", {
            "habilidades_faltantes": [" c++ "]
        }, format="json").status_code, 400)
        self.client.credentials()
        self.assertEqual(self.client.get("/api/postulaciones/habilidades").status_code, 401)
        self.assertEqual(self.client.patch(f"/api/postulaciones/{p.id}", {
            "match_porcentaje": 80
        }, format="json").status_code, 401)

    def test_habilidades_agrega_todas_las_filtradas_sin_paginacion(self):
        other = Empresa.objects.create(nombre="Other")
        a = Postulacion.objects.create(vacante=self.vacante(), estado="enviada",
            match_porcentaje=80, habilidades_faltantes=[" AWS", "aws", "C++"],
            habilidades_coincidentes=["Python"])
        b = Postulacion.objects.create(vacante=self.vacante(url="https://example.com/2"),
            estado="vista", match_porcentaje=60,
            habilidades_faltantes=["aws", "C#"], habilidades_coincidentes=["python", "C++"])
        Postulacion.objects.create(vacante=self.vacante(url="https://example.com/3", empresa=other),
            estado="enviada", habilidades_faltantes=["Rust"])
        result = self.client.get("/api/postulaciones/habilidades", {
            "empresa": "acme", "estado": "enviada,vista", "page": 1, "page_size": 1
        })
        self.assertEqual(result.status_code, 200, result.content)
        data = result.json()
        self.assertEqual((data["total_postulaciones"], data["evaluadas"], data["match_promedio"]),
                         (2, 2, 70.0))
        rows = {r["habilidad"].casefold(): r for r in data["habilidades"]}
        self.assertEqual(rows["aws"]["total"], 2)
        self.assertEqual(rows["aws"]["faltantes"], 2)
        self.assertEqual(rows["aws"]["postulacion_ids"], [a.id, b.id])
        self.assertEqual(rows["c++"]["total"], 2)
        self.assertEqual(rows["c++"]["faltantes"], 1)
        self.assertEqual(rows["c++"]["coincidentes"], 1)
        self.assertIn("c#", rows)
        self.assertNotIn("rust", rows)

    def test_match_sin_evaluar_y_score_cero_en_lecturas_y_resumen(self):
        empty = Postulacion.objects.create(vacante=self.vacante())
        zero = Postulacion.objects.create(vacante=self.vacante(url="https://example.com/zero"),
            match_porcentaje=0, habilidades_faltantes=["C#"])
        list_response = self.client.get("/api/postulaciones")
        self.assertEqual(list_response.status_code, 200, list_response.content)
        rows = {row["id"]: row for row in list_response.json()}
        self.assertIsNone(rows[empty.id]["match_porcentaje"])
        self.assertEqual(rows[empty.id]["habilidades_coincidentes"], [])
        self.assertEqual(rows[empty.id]["habilidades_faltantes"], [])
        self.assertEqual(rows[empty.id]["match_notas"], "")
        detail = self.client.get(f"/api/postulaciones/{zero.id}")
        self.assertEqual(detail.status_code, 200, detail.content)
        self.assertEqual(detail.json()["match_porcentaje"], 0)
        self.assertEqual(detail.json()["habilidades_faltantes"], ["C#"])
        summary = self.client.get("/api/postulaciones/habilidades").json()
        self.assertEqual((summary["total_postulaciones"], summary["evaluadas"], summary["match_promedio"]),
                         (2, 1, 0.0))
