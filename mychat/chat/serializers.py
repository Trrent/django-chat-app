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
        

class MessageSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')

    
    class Meta:
        model = Message
        fields = ['id', 'room', 'user', 'username', 'text', 'type', 'timestamp']
        read_only_fields = ['timestamp']
    
    def get_attachment_url(self, obj):
        if hasattr(obj, 'attachment') and obj.attachment:
            return obj.attachment.url
        return None