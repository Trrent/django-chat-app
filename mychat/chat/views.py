from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Message, Room, Membership
from .serializers import RoomSerializer, MembershipSerializer

    
class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        room = serializer.save()
        Membership.objects.get_or_create(user=self.request.user, room=room)
        
    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        room = self.get_object()
        Membership.objects.get_or_create(user=request.user, room=room)[0]
        return Response(
            {"message": f"You have joined the room '{room.name}'."},
            status=status.HTTP_200_OK
        )
    
    
class MembershipViewSet(viewsets.ModelViewSet):
    queryset = Membership.objects.all()
    serializer_class = MembershipSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)