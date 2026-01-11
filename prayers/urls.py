from django.urls import path
from . import views

urlpatterns = [
    path("", views.screen),
    path("api/config/", views.api_config),
    path("api/today/", views.api_today),
]
