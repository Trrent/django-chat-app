from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProfileViewSet, RoomViewSet, MembershipViewSet
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


router = DefaultRouter()
router.register('rooms', RoomViewSet, basename='room')
router.register('memberships', MembershipViewSet, basename='membership')

urlpatterns = [
    path('api/', include(router.urls)),
    
    path('api/profile/', ProfileViewSet.as_view(), name='profile'),
    
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
