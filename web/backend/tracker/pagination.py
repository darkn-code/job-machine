from rest_framework.pagination import PageNumberPagination


class OptionalPagination(PageNumberPagination):
    """Pagina solo si se pide `?page=`; sin él devuelve la lista completa (más simple para el bot)."""

    page_size_query_param = "page_size"
    max_page_size = 500

    def paginate_queryset(self, queryset, request, view=None):
        if self.page_query_param not in request.query_params:
            return None
        return super().paginate_queryset(queryset, request, view)
