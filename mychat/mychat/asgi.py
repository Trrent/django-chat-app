import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mychat.settings')
django.setup()


from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack  
import chat.routing

print("→ Loading ASGI application from mychat/asgi.py…")

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(chat.routing.websocket_urlpatterns)
    ),
})
