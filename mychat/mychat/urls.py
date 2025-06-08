from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from django.conf import settings
from django.views.generic import TemplateView


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/chat/', include('chat.urls')),
    path('api/auth/', include('auth_app.urls')),
    path('', TemplateView.as_view(template_name='index.html'), name='index'),
    path('auth/', TemplateView.as_view(template_name='auth.html'), name='auth'),
]

urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
