from django.db import models
from django.utils import timezone
from django.conf import settings


class Room(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class Message(models.Model):
    CHAT = 'chat'
    INFO = 'info'
    TYPE_CHOICES = [
        (CHAT, 'Chat'),
        (INFO, 'Info'),
    ]
    
    room = models.ForeignKey(Room, related_name='messages', on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='messages', on_delete=models.CASCADE, null=True, blank=True)
    text = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default=CHAT)
    
    class Meta:
        ordering = ['timestamp']
        
    def __str__(self):
        ts = self.timestamp.strftime('%H:%M:%S')
        if self.type == self.INFO:
            return f"[{ts}] {self.text}"
        elif self.user:
            return f"[{ts}] {self.user.username}: {self.text}"
        else:
            return f"[{ts}] {self.text}"
    

class Membership(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='memberships', on_delete=models.CASCADE)
    room = models.ForeignKey(Room, related_name='members', on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'room')

    def __str__(self):
        return f"{self.user.username} in {self.room.name}"