from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("tracker", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="postulacion", name="match_porcentaje",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="postulacion", name="habilidades_coincidentes",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="postulacion", name="habilidades_faltantes",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="postulacion", name="match_notas",
            field=models.TextField(blank=True),
        ),
    ]
