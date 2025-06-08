from rest_framework import serializers
from .models import Message, Room, Membership


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'name']
        

class MembershipSerializer(serializers.ModelSerializer):
    room = RoomSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ['room', 'joined_at']
        read_only_fields = ['joined_at']        