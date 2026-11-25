export interface HangoutBoxProps {
  title: string;
  id: string;
  imageUrl: string;
  time: string;
  location: string;
  members: number;
  mainMembers: Array<{
    name: string;
    avatarUrl: string;
  }>;
  interests: Array<string>;
}

export interface HangoutMember {
  id: string;
  name: string;
  avatarUrl: string;
  role: string; // 'host' | 'member'
  status: string; // 'joined' | 'left' | 'removed'
}

export interface HangoutDetailData {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  activityType: string;
  mood: string | null;
  locationName: string;
  locationAddress: string | null;
  locationLat: number;
  locationLng: number;
  scheduledAt: string;
  scheduledAtFormatted: string;
  maxParticipants: number;
  currentParticipants: number;
  status: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl: string;
  members: HangoutMember[];
  interests: string[];
}

export interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  sentBy: string;
  time: string;
  avatarUrl: string;
  members: number;
  isRead: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  text: string;
  sentBy: string;
  avatarUrl: string;
  time: string;
  isMe: boolean;
  replyTo?: {
    id: string;
    sentBy: string;
    text: string;
  };
}
