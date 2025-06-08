from django.conf import settings
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.backends import TokenBackend
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

User = get_user_model()

@database_sync_to_async
def get_user_from_payload(payload):
    try:
        return User.objects.get(id=payload['user_id'])
    except User.DoesNotExist:
        return None

class JWTAuthMiddleware:
    def __init__(self, app):
        self.app = app
        self.token_backend = TokenBackend(
            algorithm=settings.SIMPLE_JWT['ALGORITHM'],
            signing_key=settings.SIMPLE_JWT['SIGNING_KEY'],
        )

    async def __call__(self, scope, receive, send):
        query_string = scope['query_string'].decode()
        params = dict(param.split('=') for param in query_string.split('&') if '=' in param)
        token = params.get('token', None)
        if token:
            try:
                validated = self.token_backend.decode(token, verify=True)
                user = await get_user_from_payload(validated)
                scope['user'] = user
            except (InvalidToken, TokenError):
                scope['user'] = None
        else:
            scope['user'] = None

        return await self.app(scope, receive, send)
