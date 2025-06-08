from rest_framework import serializers
from django.contrib.auth.models import User 
from .models import Profile


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ('username', 'email', 'password')
        extra_kwargs = {
            'password': {'write_only': True}
        }
        
    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email = validated_data['email'],
            password=validated_data['password']
        )
    
    
class ProfileSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    class Meta:
        model = Profile
        fields = ['nickname', 'avatar', 'avatar_url']

    def get_avatar_url(self, obj):
        return obj.avatar.url if obj.avatar else None        


class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id','username')