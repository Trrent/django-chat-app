from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RoomViewSet, MembershipViewSet


router = DefaultRouter()
router.register('rooms', RoomViewSet, basename='room')
router.register('memberships', MembershipViewSet, basename='membership')


urlpatterns = [
    path('', include(router.urls)),
]
