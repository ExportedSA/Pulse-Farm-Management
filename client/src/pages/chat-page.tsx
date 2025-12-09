import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { pulseGet, pulsePost, pulsePut, pulseDelete, pulseUpload } from '@/lib/pulseApi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageSquare, Send, Pin, Bell, BellOff, Search, MoreVertical, Phone, Video, Smile, Paperclip, Mic, UserPlus, MessageSquarePlus, Edit2, Trash2, X, FileText, Image, Download, Check, CheckCheck, AtSign, Wifi, WifiOff, Reply, Clock, Calendar, FolderOpen, ChevronDown, ChevronRight, ThumbsUp, Heart, Laugh, PartyPopper, Frown, Angry, CircleDot, Forward, Copy, Monitor, Maximize2, Minimize2, Volume2, VolumeX, VideoOff } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { toast } from 'sonner';
import Peer from 'simple-peer';
import { useChatContext } from '@/contexts/ChatContext';
import { format, startOfDay, isToday, isYesterday, subDays } from 'date-fns';
import { useDropzone } from 'react-dropzone';

interface Channel {
  id: string;
  type: string;
  name: string | null;
  description?: string;
  members: Array<{ userId: string; name: string; avatar?: string }>;
  adminUserIds?: string[];
  isMuted?: boolean;
  isPublic?: boolean;
  isArchived?: boolean;
  createdById?: string;
  createdAt?: string;
}

interface Message {
  id: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  body: string;
  createdAt: string;
  reads: any[];
  pins?: any[];
  isOwn?: boolean;
  isEdited?: boolean;
  editedAt?: string;
  attachments?: Attachment[];
  reactions?: MessageReaction[];
  replyTo?: { id: string; body: string; userName: string };
  threadCount?: number;
  isScheduled?: boolean;
  scheduledFor?: string;
}

interface MessageReaction {
  emoji: string;
  users: { id: string; name: string }[];
  count: number;
}

interface OnlineUser {
  id: string;
  name: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: string;
}

interface ChannelCategory {
  id: string;
  name: string;
  isExpanded: boolean;
  channels: string[];
}

interface ScheduledMessage {
  id: string;
  channelId: string;
  body: string;
  scheduledFor: string;
  createdAt: string;
}

interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image?: string;
  siteName?: string;
}

interface MessageGroup {
  date: string;
  label: string;
  messages: Message[];
}

interface GifResult {
  id: string;
  url: string;
  preview: string;
  title: string;
}

interface CallState {
  id: string;
  type: 'voice' | 'video';
  status: 'ringing' | 'connecting' | 'connected' | 'ended';
  remoteUserId: string;
  remoteUserName: string;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  peer?: Peer.Instance;
  isIncoming: boolean;
  startTime?: Date;
}

interface CallMessage {
  type: 'call-offer' | 'call-answer' | 'call-ice-candidate' | 'call-hangup' | 'call-ring';
  callId: string;
  callType: 'voice' | 'video';
  fromUserId: string;
  toUserId: string;
  signal?: any;
  candidate?: RTCIceCandidateInit;
}

interface Attachment {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

interface UnreadCounts {
  [channelId: string]: number;
}

interface TypingUsers {
  [channelId: string]: string[];
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Utility function to group messages by date
const groupMessagesByDate = (messages: Message[]): MessageGroup[] => {
  const groups: { [key: string]: MessageGroup } = {};
  
  messages.forEach(message => {
    const messageDate = new Date(message.createdAt);
    const dateStart = startOfDay(messageDate);
    const dateKey = dateStart.toISOString();
    
    let label: string;
    if (isToday(messageDate)) {
      label = 'Today';
    } else if (isYesterday(messageDate)) {
      label = 'Yesterday';
    } else if (messageDate > subDays(new Date(), 7)) {
      label = format(messageDate, 'EEEE'); // Day of week
    } else {
      label = format(messageDate, 'MMM d, yyyy'); // Full date
    }
    
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: dateKey,
        label,
        messages: []
      };
    }
    
    groups[dateKey].messages.push(message);
  });
  
  // Convert to array and sort by date (oldest first for chronological display)
  return Object.values(groups).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

export default function ChatPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Add user states
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  
  // New chat states
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatSearchQuery, setNewChatSearchQuery] = useState('');
  const [newChatSearchResults, setNewChatSearchResults] = useState<User[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<User[]>([]);
  const [newChatName, setNewChatName] = useState('');
  const [searchingNewChatUsers, setSearchingNewChatUsers] = useState(false);

  // Edit/Delete states
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageBody, setEditingMessageBody] = useState('');
  
  // Unread counts and typing indicators
  const { unreadCounts, setUnreadCounts, incrementUnreadCount, clearUnreadCount } = useChatContext();
  const [typingUsers, setTypingUsers] = useState<TypingUsers>({});
  
  // Group messages by date for display
  const groupedMessages = useMemo(() => 
    groupMessagesByDate(messages), 
    [messages]
  );

  // Drag & drop configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      const newAttachments = acceptedFiles.map(file => ({
        url: URL.createObjectURL(file),
        filename: file.name,
        size: file.size,
        mimetype: file.type,
      }));
      setPendingAttachments(prev => [...prev, ...newAttachments]);
      toast.success(`Added ${acceptedFiles.length} file${acceptedFiles.length > 1 ? 's' : ''}`);
    },
    noClick: true,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm'],
      'audio/*': ['.mp3', '.wav', '.ogg', '.m4a'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
      'application/x-7z-compressed': ['.7z'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    onDropRejected: (rejectedFiles) => {
      toast.error(`Some files were rejected. Max size: 50MB, supported formats: images, videos, audio, PDF, Office documents, text files, and archives.`);
    }
  });
  
  // File attachment states
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Mention states
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<User[]>([]);
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerForMessage, setEmojiPickerForMessage] = useState<string | null>(null);

  // Reply/Thread states
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [threadParentMessage, setThreadParentMessage] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);

  // Online status - will be updated by WebSocket
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([
    { id: 'user-1', name: 'John Smith', status: 'online' },
    { id: 'user-2', name: 'Sarah Johnson', status: 'away', lastSeen: new Date(Date.now() - 300000).toISOString() },
    { id: 'user-3', name: 'Mike Wilson', status: 'busy' },
    { id: 'user-4', name: 'Emily Brown', status: 'offline', lastSeen: new Date(Date.now() - 3600000).toISOString() },
  ]);

  // Typing user names (for display)
  const [typingUserNames, setTypingUserNames] = useState<{ [channelId: string]: string[] }>({});

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Message search
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [messageSearchResults, setMessageSearchResults] = useState<Message[]>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);

  // Scheduled messages
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);

  // GIF picker
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifResults, setGifResults] = useState<{ id: string; url: string; preview: string; title: string }[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);

  // Voice message
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Link preview
  const [linkPreviews, setLinkPreviews] = useState<{ [messageId: string]: LinkPreview }>({});

  // Image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Forward message
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);

  // Channel management
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [channelDescription, setChannelDescription] = useState('');
  const [channelIsPublic, setChannelIsPublic] = useState(true);
  const [showArchivedChannels, setShowArchivedChannels] = useState(false);

  // Call management
  const [activeCall, setActiveCall] = useState<CallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallState | null>(null);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  const pendingSignalsRef = useRef<Map<string, any[]>>(new Map());

  // Channel categories
  const [channelCategories, setChannelCategories] = useState<ChannelCategory[]>([
    { id: 'cat-1', name: 'General', isExpanded: true, channels: [] },
    { id: 'cat-2', name: 'Operations', isExpanded: true, channels: [] },
    { id: 'cat-3', name: 'Direct Messages', isExpanded: true, channels: [] },
  ]);

  // Common emoji reactions
  const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😢', '😠', '👀', '🔥', '✅', '❌'];

  // Full emoji picker categories
  const EMOJI_CATEGORIES = {
    'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬'],
    'Gestures': ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿'],
    'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
    'Animals': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'],
    'Food': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊'],
    'Objects': ['⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓'],
    'Symbols': ['✅', '❌', '❓', '❗', '‼️', '⁉️', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧']
  };

  // ============================================
  // CALL SIGNALING HANDLERS
  // ============================================

  const handleCallOffer = useCallback((callMessage: any) => {
    if (callMessage.toUserId !== '1') return; // Not for current user

    const incomingCallState: CallState = {
      id: callMessage.callId,
      type: callMessage.callType,
      status: 'ringing',
      remoteUserId: callMessage.fromUserId,
      remoteUserName: callMessage.fromUserName || 'Unknown User',
      isIncoming: true
    };

    setIncomingCall(incomingCallState);
    toast.info(`${incomingCallState.remoteUserName} is calling you...`);
  }, []);

  const handleCallAnswer = useCallback((callMessage: any) => {
    if (!activeCall || callMessage.callId !== activeCall.id) {
      // Buffer signal if peer not ready yet
      if (!activeCall) {
        const pending = pendingSignalsRef.current.get(callMessage.callId) || [];
        pending.push({ type: 'answer', signal: callMessage.signal });
        pendingSignalsRef.current.set(callMessage.callId, pending);
      }
      return;
    }

    // Process the answer signal
    if (activeCall.peer && callMessage.signal) {
      activeCall.peer.signal(callMessage.signal);
    }
  }, [activeCall]);

  const handleCallIceCandidate = useCallback((callMessage: any) => {
    if (!activeCall || callMessage.callId !== activeCall.id) {
      // Buffer signal if peer not ready yet
      if (!activeCall) {
        const pending = pendingSignalsRef.current.get(callMessage.callId) || [];
        pending.push({ type: 'ice-candidate', signal: callMessage.signal });
        pendingSignalsRef.current.set(callMessage.callId, pending);
      }
      return;
    }

    // Process ICE candidate
    if (activeCall.peer && callMessage.signal) {
      activeCall.peer.signal(callMessage.signal);
    }
  }, [activeCall]);

  const handleCallRing = useCallback((callMessage: any) => {
    if (callMessage.toUserId !== '1') return; // Not for current user
    
    // Ring notification (already handled by offer)
  }, []);

  const handleCallHangup = useCallback((callMessage: any) => {
    // Handle incoming hangup
    if (incomingCall && callMessage.callId === incomingCall.id) {
      setIncomingCall(null);
      toast.info('Call ended');
      return;
    }

    // Handle active call hangup
    if (activeCall && callMessage.callId === activeCall.id) {
      endCall();
      toast.info('Call ended by other party');
    }
  }, [activeCall, incomingCall]);

  // WebSocket connection
  const handleNewMessage = useCallback((channelId: string, message: any) => {
    if (channelId === activeChannelId) {
      setMessages(prev => [...prev, { ...message, isOwn: message.userId === 'demo-user' }]);
    } else {
      // Update unread count for other channels
      incrementUnreadCount(channelId);
      
      // Show toast notification for messages in other channels
      if (message.userId !== 'demo-user') {
        const channel = channels.find(c => c.id === channelId);
        const channelName = channel?.name || channel?.members.map(m => m.name).join(', ') || 'Chat';
        toast.info(`New message in ${channelName}`, {
          description: message.body?.substring(0, 50) + (message.body?.length > 50 ? '...' : ''),
          action: {
            label: 'View',
            onClick: () => setActiveChannelId(channelId)
          },
          duration: 4000,
        });
        
        // Also try to show browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`New message in ${channelName}`, {
            body: message.body?.substring(0, 100),
            icon: '/favicon.ico',
          });
        }
      }
    }
  }, [activeChannelId, channels]);

  const handleMessageEdited = useCallback((channelId: string, messageId: string, newBody: string, editedAt: string) => {
    if (channelId === activeChannelId) {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, body: newBody, isEdited: true, editedAt }
          : msg
      ));
    }
  }, [activeChannelId]);

  const handleMessageDeleted = useCallback((channelId: string, messageId: string) => {
    if (channelId === activeChannelId) {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    }
  }, [activeChannelId]);

  const handleTyping = useCallback((channelId: string, userId: string, isTyping: boolean) => {
    setTypingUsers(prev => {
      const channelTyping = prev[channelId] || [];
      if (isTyping && !channelTyping.includes(userId)) {
        return { ...prev, [channelId]: [...channelTyping, userId] };
      } else if (!isTyping) {
        return { ...prev, [channelId]: channelTyping.filter(id => id !== userId) };
      }
      return prev;
    });
    
    // Also update typing user names for display
    const channel = channels.find(c => c.id === channelId);
    if (channel) {
      const userName = channel.members.find(m => m.userId === userId)?.name || 'Someone';
      setTypingUserNames(prev => {
        const channelNames = prev[channelId] || [];
        if (isTyping && !channelNames.includes(userName)) {
          return { ...prev, [channelId]: [...channelNames, userName] };
        } else if (!isTyping) {
          return { ...prev, [channelId]: channelNames.filter(n => n !== userName) };
        }
        return prev;
      });
    }
  }, [channels]);

  const handleUnreadCount = useCallback((channelId: string, count: number) => {
    setUnreadCounts(prev => ({ ...prev, [channelId]: count }));
  }, []);

  const handleNotification = useCallback((notification: any) => {
    if (notification.type === 'mention') {
      toast.info(`${notification.fromUserName} mentioned you in ${notification.channelName}`, {
        description: notification.preview,
        action: {
          label: 'View',
          onClick: () => setActiveChannelId(notification.channelId)
        }
      });
    } else if (notification.type === 'new_message') {
      // Show push notification for new messages when not in that channel
      if (notification.channelId !== activeChannelId) {
        toast.info(`New message from ${notification.fromUserName}`, {
          description: notification.preview?.substring(0, 50) + (notification.preview?.length > 50 ? '...' : ''),
          action: {
            label: 'View',
            onClick: () => setActiveChannelId(notification.channelId)
          }
        });
      }
    }
  }, [activeChannelId]);

  // Handle user coming online
  const handleUserOnline = useCallback((channelId: string, userId: string) => {
    setOnlineUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, status: 'online' as const } : user
    ));
    
    // Find user name from channel members
    const channel = channels.find(c => c.id === channelId);
    const userName = channel?.members.find(m => m.userId === userId)?.name;
    if (userName) {
      toast.success(`${userName} is now online`, { duration: 2000 });
    }
  }, [channels]);

  // Handle user going offline
  const handleUserOffline = useCallback((channelId: string, userId: string) => {
    setOnlineUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, status: 'offline' as const } : user
    ));
    
    // Find user name from channel members
    const channel = channels.find(c => c.id === channelId);
    const userName = channel?.members.find(m => m.userId === userId)?.name;
    if (userName) {
      toast.info(`${userName} is now offline`, { duration: 2000 });
    }
  }, [channels]);

  // WebSocket connection
  const { isConnected, sendTypingIndicator, sendCallMessage, subscribeToChannel, unsubscribeFromChannel } = useChatWebSocket({
    onNewMessage: handleNewMessage,
    onMessageEdited: handleMessageEdited,
    onMessageDeleted: handleMessageDeleted,
    onTyping: handleTyping,
    onMessageRead: handleMessageRead,
    onUnreadCount: handleUnreadCount,
    onNotification: handleNotification,
    onUserOnline: handleUserOnline,
    onUserOffline: handleUserOffline,
    onCallOffer: handleCallOffer,
    onCallAnswer: handleCallAnswer,
    onCallIceCandidate: handleCallIceCandidate,
    onCallRing: handleCallRing,
    onCallHangup: handleCallHangup,
  });

  // Subscribe to active channel
  useEffect(() => {
    if (activeChannelId) {
      subscribeToChannel(activeChannelId);
      // Clear unread count when viewing channel
      clearUnreadCount(activeChannelId);
    }
    return () => {
      if (activeChannelId) {
        unsubscribeFromChannel(activeChannelId);
      }
    };
  }, [activeChannelId, subscribeToChannel, unsubscribeFromChannel, clearUnreadCount]);

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (activeChannelId) {
      loadMessages(activeChannelId);
    }
  }, [activeChannelId]);

  async function loadChannels() {
    try {
      const data = await pulseGet<Channel[]>('/chat/channels');
      setChannels(data);
      if (data.length > 0 && !activeChannelId) {
        setActiveChannelId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(channelId: string) {
    try {
      const data = await pulseGet<Message[]>(`/chat/channels/${channelId}/messages`);
      // Get the active channel to access member info
      const activeChannel = channels.find(c => c.id === channelId);
      
      // Mark own messages and add user info
      const enrichedMessages = data.map(msg => ({
        ...msg,
        isOwn: msg.userId === 'demo-user',
        userName: msg.userId === 'demo-user' ? 'You' : 
                  activeChannel?.members.find(m => m.userId === msg.userId)?.name || 'Unknown',
        userAvatar: activeChannel?.members.find(m => m.userId === msg.userId)?.avatar
      }));
      setMessages(enrichedMessages);
      if (data.length > 0) {
        const last = data[data.length - 1];
        await pulsePost(`/chat/channels/${channelId}/messages/${last.id}/read`).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Search users function
  async function searchUsers(query: string) {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearchingUsers(true);
    try {
      const results = await pulseGet<User[]>(`/chat/users/search?query=${encodeURIComponent(query)}`);
      setSearchResults(results);
    } catch (err) {
      console.error('Failed to search users:', err);
      setSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }

  // Add user to channel function
  async function addUserToChannel(userId: string) {
    if (!activeChannelId) return;
    
    try {
      const result = await pulsePost(`/chat/channels/${activeChannelId}/add-user`, { userId }) as { message: string };
      
      // Refresh channels to show updated member list
      await loadChannels();
      
      // Show success message (you could use a toast here)
      alert(result.message || 'User added successfully');
      
      // Close dialog and reset search
      setIsAddUserOpen(false);
      setUserSearchQuery('');
      setSearchResults([]);
    } catch (err: any) {
      console.error('Failed to add user:', err);
      alert(err.message || 'Failed to add user to chat');
    }
  }

  // Debounced search for adding users
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(userSearchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [userSearchQuery]);

  // Search users for new chat
  async function searchUsersForNewChat(query: string) {
    if (!query.trim()) {
      setNewChatSearchResults([]);
      return;
    }
    
    setSearchingNewChatUsers(true);
    try {
      const results = await pulseGet<User[]>(`/chat/users/search?query=${encodeURIComponent(query)}`);
      // Filter out already selected participants
      const filtered = results.filter(
        user => !selectedParticipants.some(p => p.id === user.id)
      );
      setNewChatSearchResults(filtered);
    } catch (err) {
      console.error('Failed to search users:', err);
      setNewChatSearchResults([]);
    } finally {
      setSearchingNewChatUsers(false);
    }
  }

  // Debounced search for new chat
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsersForNewChat(newChatSearchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [newChatSearchQuery, selectedParticipants]);

  // Add participant to new chat
  function addParticipant(user: User) {
    if (!selectedParticipants.some(p => p.id === user.id)) {
      setSelectedParticipants([...selectedParticipants, user]);
      setNewChatSearchQuery('');
      setNewChatSearchResults([]);
    }
  }

  // Remove participant from new chat
  function removeParticipant(userId: string) {
    setSelectedParticipants(selectedParticipants.filter(p => p.id !== userId));
  }

  // Create new chat
  async function createNewChat() {
    if (selectedParticipants.length === 0) {
      alert('Please select at least one participant');
      return;
    }

    try {
      const userIds = selectedParticipants.map(p => p.id);
      const type = selectedParticipants.length === 1 ? 'direct' : 'group';
      const name = type === 'group' && newChatName.trim() ? newChatName.trim() : null;

      await pulsePost('/chat/channels/create', {
        name,
        type,
        userIds
      });

      // Refresh channels
      await loadChannels();

      // Reset and close dialog
      setIsNewChatOpen(false);
      setSelectedParticipants([]);
      setNewChatName('');
      setNewChatSearchQuery('');
      setNewChatSearchResults([]);
    } catch (err: any) {
      console.error('Failed to create chat:', err);
      alert(err.message || 'Failed to create chat');
    }
  }

  async function handleSendMessage() {
    if ((!newMessage.trim() && pendingAttachments.length === 0) || !activeChannelId) return;
    try {
      // Build message body with attachments
      let messageBody = newMessage.trim();
      if (pendingAttachments.length > 0) {
        const attachmentLinks = pendingAttachments.map(a => `[${a.filename}](${a.url})`).join('\n');
        messageBody = messageBody ? `${messageBody}\n\n${attachmentLinks}` : attachmentLinks;
      }

      await pulsePost('/chat/messages', {
        channelId: activeChannelId,
        body: messageBody,
        mentions: selectedMentions,
      });
      setNewMessage('');
      setPendingAttachments([]);
      setSelectedMentions([]);
      // Don't reload - WebSocket will handle the update
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message');
    }
  }

  // Edit message
  async function handleEditMessage(messageId: string) {
    if (!editingMessageBody.trim()) return;
    try {
      await pulsePut(`/chat/messages/${messageId}`, {
        body: editingMessageBody.trim(),
      });
      setEditingMessageId(null);
      setEditingMessageBody('');
      toast.success('Message updated');
    } catch (err) {
      console.error('Failed to edit message:', err);
      toast.error('Failed to edit message');
    }
  }

  // Delete message
  async function handleDeleteMessage(messageId: string) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      await pulseDelete(`/chat/messages/${messageId}`);
      toast.success('Message deleted');
    } catch (err) {
      console.error('Failed to delete message:', err);
      toast.error('Failed to delete message');
    }
  }

  // Start editing a message
  function startEditingMessage(message: Message) {
    setEditingMessageId(message.id);
    setEditingMessageBody(message.body);
  }

  // Cancel editing
  function cancelEditing() {
    setEditingMessageId(null);
    setEditingMessageBody('');
  }

  // Handle file upload
  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await pulseUpload<Attachment>('/chat/upload', file);
        setPendingAttachments(prev => [...prev, result]);
      }
      toast.success('File uploaded');
    } catch (err) {
      console.error('Failed to upload file:', err);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  // Remove pending attachment
  function removePendingAttachment(index: number) {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  }

  // ============================================
  // GIF PICKER FUNCTIONS
  // ============================================
  
  // Mock GIF data (in production, use Giphy/Tenor API)
  const TRENDING_GIFS: GifResult[] = [
    { id: '1', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', preview: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.gif', title: 'Thumbs Up' },
    { id: '2', url: 'https://media.giphy.com/media/3o7TKU8RvQuomFfUUU/giphy.gif', preview: 'https://media.giphy.com/media/3o7TKU8RvQuomFfUUU/200w.gif', title: 'Celebration' },
    { id: '3', url: 'https://media.giphy.com/media/l4FGuhL4U2WyjdkaY/giphy.gif', preview: 'https://media.giphy.com/media/l4FGuhL4U2WyjdkaY/200w.gif', title: 'Thank You' },
    { id: '4', url: 'https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif', preview: 'https://media.giphy.com/media/3oz8xIsloV7zOmt81G/200w.gif', title: 'Laughing' },
    { id: '5', url: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif', preview: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/200w.gif', title: 'Wow' },
    { id: '6', url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', preview: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/200w.gif', title: 'Clapping' },
    { id: '7', url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', preview: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/200w.gif', title: 'Dancing' },
    { id: '8', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', preview: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/200w.gif', title: 'Mind Blown' },
  ];

  async function searchGifs(query: string) {
    setLoadingGifs(true);
    // Simulate API call - in production use Giphy/Tenor API
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (!query.trim()) {
      setGifResults(TRENDING_GIFS);
    } else {
      // Filter mock data by query
      const filtered = TRENDING_GIFS.filter(g => 
        g.title.toLowerCase().includes(query.toLowerCase())
      );
      setGifResults(filtered.length > 0 ? filtered : TRENDING_GIFS);
    }
    setLoadingGifs(false);
  }

  function selectGif(gif: GifResult) {
    setNewMessage(prev => prev + ` ![${gif.title}](${gif.url}) `);
    setShowGifPicker(false);
    setGifSearchQuery('');
    toast.success('GIF added to message');
  }

  // Load trending GIFs when picker opens
  useEffect(() => {
    if (showGifPicker && gifResults.length === 0) {
      searchGifs('');
    }
  }, [showGifPicker]);

  // Debounced GIF search
  useEffect(() => {
    if (showGifPicker) {
      const timeout = setTimeout(() => searchGifs(gifSearchQuery), 300);
      return () => clearTimeout(timeout);
    }
  }, [gifSearchQuery, showGifPicker]);

  // ============================================
  // VOICE MESSAGE FUNCTIONS
  // ============================================

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(audioUrl);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Update recording time
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.info('Recording started...');
    } catch (err) {
      console.error('Failed to start recording:', err);
      toast.error('Could not access microphone');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      toast.success('Recording stopped');
    }
  }

  function cancelRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  }

  async function sendVoiceMessage() {
    if (!audioBlob || !activeChannelId) return;

    try {
      // Create a file from the blob
      const file = new File([audioBlob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' });
      const result = await pulseUpload<Attachment>('/chat/upload', file);
      
      // Send message with audio attachment
      await pulsePost('/chat/messages', {
        channelId: activeChannelId,
        body: `🎤 Voice message`,
        attachments: [result],
      });

      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
      toast.success('Voice message sent');
    } catch (err) {
      console.error('Failed to send voice message:', err);
      toast.error('Failed to send voice message');
    }
  }

  function formatRecordingTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // ============================================
  // LINK PREVIEW FUNCTIONS
  // ============================================

  // Extract URLs from text
  function extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  }

  // Mock link preview fetcher (in production, use a server-side unfurling service)
  async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock previews for common domains
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return {
        url,
        title: 'YouTube Video',
        description: 'Watch this video on YouTube',
        image: 'https://www.youtube.com/img/desktop/yt_1200.png',
        siteName: 'YouTube',
      };
    } else if (url.includes('github.com')) {
      return {
        url,
        title: 'GitHub Repository',
        description: 'View this repository on GitHub',
        image: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
        siteName: 'GitHub',
      };
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      return {
        url,
        title: 'Tweet',
        description: 'View this tweet',
        image: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png',
        siteName: 'Twitter',
      };
    }
    
    // Generic preview
    return {
      url,
      title: new URL(url).hostname,
      description: 'Click to visit this link',
      siteName: new URL(url).hostname,
    };
  }

  // Check if URL is an image
  function isImageUrl(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(url);
  }

  // Check if URL is a video
  function isVideoUrl(url: string): boolean {
    return /\.(mp4|webm|ogg|mov)$/i.test(url);
  }

  // Check if URL is audio
  function isAudioUrl(url: string): boolean {
    return /\.(mp3|wav|ogg|webm|m4a)$/i.test(url);
  }

  // ============================================
  // FORWARD MESSAGE FUNCTIONS
  // ============================================

  function openForwardDialog(message: Message) {
    setMessageToForward(message);
    setShowForwardDialog(true);
  }

  async function forwardMessage(targetChannelId: string) {
    if (!messageToForward) return;

    try {
      const forwardedBody = `↪️ Forwarded message:\n\n${messageToForward.body}`;
      
      await pulsePost('/chat/messages', {
        channelId: targetChannelId,
        body: forwardedBody,
        attachments: messageToForward.attachments,
      });

      setShowForwardDialog(false);
      setMessageToForward(null);
      
      const targetChannel = channels.find(c => c.id === targetChannelId);
      const channelName = targetChannel?.name || targetChannel?.members.map(m => m.name).join(', ');
      toast.success(`Message forwarded to ${channelName}`);
    } catch (err) {
      console.error('Failed to forward message:', err);
      toast.error('Failed to forward message');
    }
  }

  function copyMessageToClipboard(message: Message) {
    navigator.clipboard.writeText(message.body);
    toast.success('Message copied to clipboard');
  }

  // ============================================
  // CHANNEL MANAGEMENT FUNCTIONS
  // ============================================

  // Check if current user is admin of channel
  function isChannelAdmin(channel: Channel): boolean {
    // For now, assume current user ID is '1' (in production, get from auth)
    const currentUserId = '1';
    return channel.adminUserIds?.includes(currentUserId) || channel.createdById === currentUserId;
  }

  // Open channel settings
  function openChannelSettings() {
    if (!activeChannelId) return;
    
    const channel = channels.find(c => c.id === activeChannelId);
    if (channel) {
      setChannelDescription(channel.description || '');
      setChannelIsPublic(channel.isPublic ?? false);
      setShowChannelSettings(true);
    }
  }

  // Update channel settings
  async function updateChannelSettings() {
    if (!activeChannelId) return;

    try {
      await pulsePut(`/chat/channels/${activeChannelId}`, {
        description: channelDescription,
        isPublic: channelIsPublic,
      });

      // Update local channels state
      setChannels(prev => prev.map(c => 
        c.id === activeChannelId 
          ? { ...c, description: channelDescription, isPublic: channelIsPublic }
          : c
      ));

      setShowChannelSettings(false);
      toast.success('Channel settings updated');
    } catch (err) {
      console.error('Failed to update channel settings:', err);
      toast.error('Failed to update channel settings');
    }
  }

  // Leave channel
  async function leaveChannel() {
    if (!activeChannelId) return;

    try {
      await pulsePost(`/chat/channels/${activeChannelId}/leave`);
      
      // Remove channel from local state
      setChannels(prev => prev.filter(c => c.id !== activeChannelId));
      setActiveChannelId(null);
      
      toast.success('You left the channel');
    } catch (err) {
      console.error('Failed to leave channel:', err);
      toast.error('Failed to leave channel');
    }
  }

  // Remove user from channel (admin only)
  async function removeUserFromChannel(userId: string, userName: string) {
    if (!activeChannelId) return;
    
    const channel = channels.find(c => c.id === activeChannelId);
    if (!channel || !isChannelAdmin(channel)) {
      toast.error('Only admins can remove users');
      return;
    }

    try {
      await pulsePost(`/chat/channels/${activeChannelId}/remove`, { userId });
      
      // Update local channels state
      setChannels(prev => prev.map(c => 
        c.id === activeChannelId 
          ? { ...c, members: c.members.filter(m => m.userId !== userId) }
          : c
      ));

      toast.success(`${userName} was removed from the channel`);
    } catch (err) {
      console.error('Failed to remove user:', err);
      toast.error('Failed to remove user');
    }
  }

  // Archive/unarchive channel (admin only)
  async function toggleArchiveChannel() {
    if (!activeChannelId) return;
    
    const channel = channels.find(c => c.id === activeChannelId);
    if (!channel || !isChannelAdmin(channel)) {
      toast.error('Only admins can archive channels');
      return;
    }

    try {
      const newArchiveStatus = !channel.isArchived;
      await pulsePost(`/chat/channels/${activeChannelId}/archive`, { 
        isArchived: newArchiveStatus 
      });
      
      // Update local channels state
      setChannels(prev => prev.map(c => 
        c.id === activeChannelId 
          ? { ...c, isArchived: newArchiveStatus }
          : c
      ));

      toast.success(newArchiveStatus ? 'Channel archived' : 'Channel unarchived');
      
      if (newArchiveStatus) {
        setActiveChannelId(null);
      }
    } catch (err) {
      console.error('Failed to toggle archive:', err);
      toast.error('Failed to update channel');
    }
  }

  // ============================================
  // CALLING FUNCTIONS
  // ============================================

  // Generate unique call ID
  function generateCallId(): string {
    return `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Start a call (voice or video)
  async function startCall(type: 'voice' | 'video', targetUserId: string, targetUserName: string) {
    if (activeCall) {
      toast.error('You are already in a call');
      return;
    }

    try {
      const callId = generateCallId();
      
      // Get user media
      const constraints = {
        audio: true,
        video: type === 'video'
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create peer connection with STUN/TURN servers for NAT traversal
      const peer = new Peer({
        initiator: true,
        trickle: true,
        stream: stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // Add TURN servers for production (requires authentication)
            // { 
            //   urls: 'turn:your-turn-server.com:3478', 
            //   username: 'user', 
            //   credential: 'pass' 
            // }
          ]
        }
      });

      // Set up call state
      const callState: CallState = {
        id: callId,
        type,
        status: 'ringing',
        remoteUserId: targetUserId,
        remoteUserName: targetUserName,
        localStream: stream,
        peer,
        isIncoming: false
      };

      setActiveCall(callState);
      activeCallIdRef.current = callId; // Update ref for timeout

      // Process any buffered signals
      const pendingSignals = pendingSignalsRef.current.get(callId) || [];
      pendingSignals.forEach(({ signal }) => {
        if (peer && signal) {
          peer.signal(signal);
        }
      });
      pendingSignalsRef.current.delete(callId);

      // Set local video
      if (type === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Handle peer events
      peer.on('signal', (signal) => {
        // Send offer via WebSocket
        const callMessage: CallMessage = {
          type: 'call-offer',
          callId,
          callType: type,
          fromUserId: '1', // Current user ID
          toUserId: targetUserId,
          signal
        };
        
        // Send through WebSocket
        sendCallMessage(callMessage);
      });

      peer.on('connect', () => {
        setActiveCall(prev => prev ? { ...prev, status: 'connected', startTime: new Date() } : null);
        toast.success('Call connected');
      });

      peer.on('stream', (remoteStream) => {
        setActiveCall(prev => prev ? { ...prev, remoteStream } : null);
        if (type === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      peer.on('close', () => {
        endCall();
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        toast.error('Call connection failed');
        endCall();
      });

      // Send ring notification
      const ringMessage: CallMessage = {
        type: 'call-ring',
        callId,
        callType: type,
        fromUserId: '1',
        toUserId: targetUserId
      };
      
      sendCallMessage(ringMessage);

      // Auto-end call after 30 seconds if not answered
      callTimeoutRef.current = setTimeout(() => {
        // Use ref instead of state to avoid stale closure
        if (activeCallIdRef.current === callId) {
          toast.error('Call not answered');
          endCall();
        }
      }, 30000);

    } catch (err) {
      console.error('Failed to start call:', err);
      toast.error('Failed to start call. Please check camera/microphone permissions.');
    }
  }

  // Accept incoming call
  async function acceptCall() {
    if (!incomingCall) return;

    try {
      const constraints = {
        audio: true,
        video: incomingCall.type === 'video'
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create peer connection with STUN/TURN servers for NAT traversal
      const peer = new Peer({
        initiator: false,
        trickle: true,
        stream: stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // Add TURN servers for production (requires authentication)
            // { 
            //   urls: 'turn:your-turn-server.com:3478', 
            //   username: 'user', 
            //   credential: 'pass' 
            // }
          ]
        }
      });

      // Update call state
      const callState: CallState = {
        ...incomingCall,
        status: 'connecting',
        localStream: stream,
        peer,
        isIncoming: false
      };

      setActiveCall(callState);
      activeCallIdRef.current = incomingCall.id; // Update ref for timeout
      setIncomingCall(null);

      // Process any buffered signals
      const pendingSignals = pendingSignalsRef.current.get(incomingCall.id) || [];
      pendingSignals.forEach(({ signal }) => {
        if (peer && signal) {
          peer.signal(signal);
        }
      });
      pendingSignalsRef.current.delete(incomingCall.id);

      // Set local video
      if (incomingCall.type === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Handle peer events
      peer.on('signal', (signal) => {
        // Send answer via WebSocket
        const callMessage: CallMessage = {
          type: 'call-answer',
          callId: incomingCall.id,
          callType: incomingCall.type,
          fromUserId: '1',
          toUserId: incomingCall.remoteUserId,
          signal
        };
        
        sendCallMessage(callMessage);
      });

      peer.on('connect', () => {
        setActiveCall(prev => prev ? { ...prev, status: 'connected', startTime: new Date() } : null);
        toast.success('Call connected');
      });

      peer.on('stream', (remoteStream) => {
        setActiveCall(prev => prev ? { ...prev, remoteStream } : null);
        if (incomingCall.type === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      peer.on('close', () => {
        endCall();
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        toast.error('Call connection failed');
        endCall();
      });

    } catch (err) {
      console.error('Failed to accept call:', err);
      toast.error('Failed to accept call');
    }
  }

  // Reject incoming call
  function rejectCall() {
    if (!incomingCall) return;

    // Send reject message via WebSocket
    const callMessage: CallMessage = {
      type: 'call-hangup',
      callId: incomingCall.id,
      callType: incomingCall.type,
      fromUserId: '1',
      toUserId: incomingCall.remoteUserId
    };
    
    setIncomingCall(null);
  }

  // End active call
  function endCall() {
    if (activeCall) {
      // Send hangup message
      const callMessage: CallMessage = {
        type: 'call-hangup',
        callId: activeCall.id,
        callType: activeCall.type,
        fromUserId: '1',
        toUserId: activeCall.remoteUserId
      };
      
      // Clean up peer
      if (activeCall.peer) {
        activeCall.peer.destroy();
      }

      // Clean up streams
      if (activeCall.localStream) {
        activeCall.localStream.getTracks().forEach(track => track.stop());
      }

      // Clear timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }

      // Reset video refs
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      setActiveCall(null);
      activeCallIdRef.current = null; // Clear ref to prevent stale issues
      setIsCallMinimized(false);
      setIsMuted(false);
      setIsVideoOff(false);
      setIsScreenSharing(false);
    }
  }

  // Toggle mute
  function toggleMute() {
    if (activeCall?.localStream) {
      const audioTrack = activeCall.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }

  // Toggle video
  function toggleVideo() {
    if (activeCall?.localStream) {
      const videoTrack = activeCall.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }

  // Start screen sharing
  async function startScreenShare() {
    if (!activeCall || activeCall.type !== 'video') return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = screenStream.getVideoTracks()[0];
      
      // Replace video track in peer
      if (activeCall.peer && activeCall.localStream) {
        const sender = activeCall.peer._pc?.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
          setIsScreenSharing(true);
          
          // Handle screen share end
          videoTrack.onended = () => {
            stopScreenShare();
          };
        }
      }
    } catch (err) {
      console.error('Failed to start screen share:', err);
      toast.error('Failed to start screen sharing');
    }
  }

  // Stop screen sharing
  async function stopScreenShare() {
    if (!activeCall || !isScreenSharing) return;

    try {
      // Get original camera stream
      const constraints = { video: true };
      const cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = cameraStream.getVideoTracks()[0];
      
      // Replace video track in peer
      if (activeCall.peer) {
        const sender = activeCall.peer._pc?.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
          setIsScreenSharing(false);
          
          // Update local video
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = cameraStream;
          }
        }
      }
    } catch (err) {
      console.error('Failed to stop screen share:', err);
    }
  }

  // Handle typing indicator
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  function handleInputChange(value: string) {
    setNewMessage(value);
    
    // Send typing indicator
    if (activeChannelId) {
      sendTypingIndicator(activeChannelId, true);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (activeChannelId) {
          sendTypingIndicator(activeChannelId, false);
        }
      }, 2000);
    }

    // Check for @mention trigger
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentionPopup(true);
      setMentionSearchQuery('');
    } else if (lastAtIndex !== -1) {
      const afterAt = value.substring(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        setShowMentionPopup(true);
        setMentionSearchQuery(afterAt);
      } else {
        setShowMentionPopup(false);
      }
    } else {
      setShowMentionPopup(false);
    }
  }

  // Insert mention into message
  function insertMention(user: User) {
    const lastAtIndex = newMessage.lastIndexOf('@');
    const beforeAt = newMessage.substring(0, lastAtIndex);
    const newText = `${beforeAt}@[${user.name}](${user.id}) `;
    setNewMessage(newText);
    setSelectedMentions(prev => [...prev, user.id]);
    setShowMentionPopup(false);
  }

  // Search for mention users
  useEffect(() => {
    if (showMentionPopup && activeChannelId) {
      const activeChannel = channels.find(c => c.id === activeChannelId);
      if (activeChannel) {
        const filtered = activeChannel.members.filter(m => 
          m.name.toLowerCase().includes(mentionSearchQuery.toLowerCase()) &&
          m.userId !== 'demo-user'
        );
        setMentionResults(filtered.map(m => ({ id: m.userId, name: m.name, email: '', role: '' })));
      }
    }
  }, [showMentionPopup, mentionSearchQuery, activeChannelId, channels]);

  async function handleToggleMute(channelId: string, isMuted: boolean) {
    try {
      const path = isMuted
        ? `/chat/channels/${channelId}/unmute`
        : `/chat/channels/${channelId}/mute`;
      await pulsePost(path);
      setChannels(prev =>
        prev.map(c => (c.id === channelId ? { ...c, isMuted: !isMuted } : c))
      );
    } catch (err) {
      console.error('Failed to toggle mute:', err);
    }
  }

  async function handleTogglePin(messageId: string, isPinned: boolean) {
    if (!activeChannelId) return;
    try {
      const path = isPinned
        ? `/chat/channels/${activeChannelId}/messages/${messageId}/unpin`
        : `/chat/channels/${activeChannelId}/messages/${messageId}/pin`;
      await pulsePost(path);
      loadMessages(activeChannelId);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  }

  const activeChannel = channels.find(c => c.id === activeChannelId);
  const filteredChannels = channels.filter(channel => 
    channel.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    channel.members.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Add reaction to message
  function handleAddReaction(messageId: string, emoji: string) {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;
      
      const existingReactions = msg.reactions || [];
      const existingReaction = existingReactions.find(r => r.emoji === emoji);
      
      if (existingReaction) {
        // Check if user already reacted
        const userReacted = existingReaction.users.some(u => u.id === 'demo-user');
        if (userReacted) {
          // Remove user's reaction
          const updatedUsers = existingReaction.users.filter(u => u.id !== 'demo-user');
          if (updatedUsers.length === 0) {
            return { ...msg, reactions: existingReactions.filter(r => r.emoji !== emoji) };
          }
          return {
            ...msg,
            reactions: existingReactions.map(r => 
              r.emoji === emoji ? { ...r, users: updatedUsers, count: updatedUsers.length } : r
            )
          };
        } else {
          // Add user's reaction
          return {
            ...msg,
            reactions: existingReactions.map(r => 
              r.emoji === emoji 
                ? { ...r, users: [...r.users, { id: 'demo-user', name: 'You' }], count: r.count + 1 }
                : r
            )
          };
        }
      } else {
        // Add new reaction
        return {
          ...msg,
          reactions: [...existingReactions, { emoji, users: [{ id: 'demo-user', name: 'You' }], count: 1 }]
        };
      }
    }));
    setEmojiPickerForMessage(null);
    toast.success(`Reacted with ${emoji}`);
  }

  // Insert emoji into message input
  function insertEmoji(emoji: string) {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  }

  // Start replying to a message
  function startReply(message: Message) {
    setReplyingTo(message);
  }

  // Cancel reply
  function cancelReply() {
    setReplyingTo(null);
  }

  // Open thread view
  function openThread(message: Message) {
    setThreadParentMessage(message);
    setShowThread(true);
    // Load thread messages (mock for now)
    setThreadMessages([]);
  }

  // Search messages
  async function searchMessages(query: string) {
    if (!query.trim() || !activeChannelId) {
      setMessageSearchResults([]);
      return;
    }
    
    setSearchingMessages(true);
    // Filter current messages (in production, this would be an API call)
    const results = messages.filter(msg => 
      msg.body.toLowerCase().includes(query.toLowerCase())
    );
    setMessageSearchResults(results);
    setSearchingMessages(false);
  }

  // Debounced message search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (showMessageSearch) {
        searchMessages(messageSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [messageSearchQuery, showMessageSearch]);

  // Schedule a message
  function handleScheduleMessage() {
    if (!newMessage.trim() || !scheduleDate || !scheduleTime || !activeChannelId) {
      toast.error('Please fill in all fields');
      return;
    }
    
    const scheduledFor = `${scheduleDate}T${scheduleTime}`;
    const scheduled: ScheduledMessage = {
      id: `sched-${Date.now()}`,
      channelId: activeChannelId,
      body: newMessage,
      scheduledFor,
      createdAt: new Date().toISOString(),
    };
    
    setScheduledMessages(prev => [...prev, scheduled]);
    setNewMessage('');
    setScheduleDate('');
    setScheduleTime('');
    setShowScheduleDialog(false);
    toast.success(`Message scheduled for ${new Date(scheduledFor).toLocaleString()}`);
  }

  // Get online status color
  function getStatusColor(status: OnlineUser['status']) {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  }

  // Toggle category expansion
  function toggleCategory(categoryId: string) {
    setChannelCategories(prev => prev.map(cat => 
      cat.id === categoryId ? { ...cat, isExpanded: !cat.isExpanded } : cat
    ));
  }

  if (loading) {
    return <div className="p-8">Loading chat...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Left Sidebar - Chat List */}
      <div className="w-80 bg-pulse-950 flex flex-col">
        {/* Sidebar Header */}
        <div className="px-4 py-4 bg-pulse-900 border-b border-pulse-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h1 className="text-white text-xl font-semibold">Team Chat</h1>
              {/* Connection status indicator */}
              <Tooltip>
                <TooltipTrigger>
                  {isConnected ? (
                    <Wifi className="h-4 w-4 text-green-400" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-400" />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex gap-2">
              <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-gray-300 hover:bg-pulse-800 hover:text-white" title="New Chat">
                    <MessageSquarePlus className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white max-w-md">
                  <DialogHeader>
                    <DialogTitle>New Chat</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Selected Participants */}
                    {selectedParticipants.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                        {selectedParticipants.map(user => (
                          <Badge key={user.id} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                            {user.name}
                            <button
                              onClick={() => removeParticipant(user.id)}
                              className="ml-1 hover:text-red-600"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Group Name (only if more than 1 participant) */}
                    {selectedParticipants.length > 1 && (
                      <Input
                        value={newChatName}
                        onChange={(e) => setNewChatName(e.target.value)}
                        placeholder="Group name (optional)"
                      />
                    )}

                    {/* Search Users */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        value={newChatSearchQuery}
                        onChange={(e) => setNewChatSearchQuery(e.target.value)}
                        placeholder="Search users to add"
                        className="pl-10"
                      />
                    </div>

                    {/* Search Results */}
                    {searchingNewChatUsers ? (
                      <div className="text-center py-4 text-gray-500">Searching...</div>
                    ) : newChatSearchResults.length > 0 ? (
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {newChatSearchResults.map(user => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                            onClick={() => addParticipant(user)}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-gray-200">
                                  {user.name?.charAt(0).toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{user.name}</p>
                                <p className="text-xs text-gray-500">{user.email}</p>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" className="text-pulse-gold">
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : newChatSearchQuery ? (
                      <div className="text-center py-4 text-gray-500">No users found</div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        Search for users to start a chat
                      </div>
                    )}

                    {/* Create Button */}
                    {selectedParticipants.length > 0 && (
                      <Button
                        onClick={createNewChat}
                        className="w-full bg-pulse-forest hover:bg-pulse-forest-dark text-white"
                      >
                        Create Chat ({selectedParticipants.length} {selectedParticipants.length === 1 ? 'participant' : 'participants'})
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button variant="ghost" size="sm" className="text-gray-300 hover:bg-pulse-800 hover:text-white">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-10 bg-pulse-800 border-pulse-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-pulse-forest focus:border-transparent"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChannels.map(channel => {
            const displayName = channel.name || channel.members.map(m => m.name).join(', ');
            
            return (
              <div
                key={channel.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-pulse-800 transition-colors border-l-2 ${
                  channel.id === activeChannelId ? 'bg-pulse-800 border-l-pulse-gold' : 'border-l-transparent'
                } ${channel.isMuted ? 'opacity-60' : ''}`}
                onClick={() => setActiveChannelId(channel.id)}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-pulse-forest text-white text-sm font-medium">
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online status indicator */}
                  {channel.type === 'direct' && (
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-pulse-950 ${
                      onlineUsers.find(u => channel.members.some(m => m.userId === u.id))?.status === 'online' 
                        ? 'bg-green-500' 
                        : onlineUsers.find(u => channel.members.some(m => m.userId === u.id))?.status === 'away'
                        ? 'bg-yellow-500'
                        : onlineUsers.find(u => channel.members.some(m => m.userId === u.id))?.status === 'busy'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                    }`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium truncate text-sm">
                      {displayName}
                    </h3>
                    <span className="text-gray-400 text-xs">
                      {channel.id === activeChannelId && messages.length > 0 
                        ? new Date(messages[messages.length - 1].createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                        : ''
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-gray-400 text-xs truncate flex-1">
                      {channel.id === activeChannelId && messages.length > 0 
                        ? messages[messages.length - 1].body 
                        : 'No messages yet'
                      }
                    </p>
                    <div className="flex items-center gap-1 ml-2">
                      {channel.isMuted && (
                        <BellOff className="h-3 w-3 text-gray-400" />
                      )}
                      {/* Unread badge */}
                      {unreadCounts[channel.id] > 0 && (
                        <Badge className="bg-pulse-gold text-white text-xs px-1.5 py-0.5 min-w-[20px] text-center">
                          {unreadCounts[channel.id] > 99 ? '99+' : unreadCounts[channel.id]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Connection status banner */}
        {!isConnected && (
          <div className="bg-red-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm">
            <WifiOff className="h-4 w-4" />
            <span>Connection lost. Reconnecting...</span>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        {activeChannel ? (
          <>
            {/* Chat Header */}
            <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-pulse-forest text-white font-medium">
                    {(activeChannel.name || activeChannel.members.map(m => m.name).join(', ')).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-gray-900 font-semibold">
                      {activeChannel.name || activeChannel.members.map(m => m.name).join(', ')}
                    </h2>
                    {/* Connection status indicator */}
                    <Tooltip>
                      <TooltipTrigger>
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                      </TooltipTrigger>
                      <TooltipContent>
                        {isConnected ? 'Connected - Real-time updates active' : 'Disconnected - Reconnecting...'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-gray-500 text-xs flex items-center gap-2">
                    <span>{activeChannel.members.length} {activeChannel.members.length === 1 ? 'member' : 'members'}</span>
                    {activeChannel.type === 'direct' && (
                      <>
                        <span>•</span>
                        <span className={`flex items-center gap-1 ${
                          onlineUsers.find(u => activeChannel.members.some(m => m.userId === u.id))?.status === 'online'
                            ? 'text-green-600'
                            : 'text-gray-400'
                        }`}>
                          <CircleDot className="h-3 w-3" />
                          {onlineUsers.find(u => activeChannel.members.some(m => m.userId === u.id))?.status || 'offline'}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-100">
                      <UserPlus className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white">
                    <DialogHeader>
                      <DialogTitle>Add Participants</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          placeholder="Search by name or email"
                          className="pl-10"
                        />
                      </div>
                      
                      {searchingUsers ? (
                        <div className="text-center py-4 text-gray-500">
                          Searching...
                        </div>
                      ) : searchResults.length > 0 ? (
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {searchResults.map(user => (
                            <div
                              key={user.id}
                              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                              onClick={() => addUserToChannel(user.id)}
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-gray-200">
                                    {user.name?.charAt(0).toUpperCase() || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">{user.name}</p>
                                  <p className="text-xs text-gray-500">{user.email}</p>
                                </div>
                              </div>
                              <Button size="sm" className="bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                                Add
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : userSearchQuery ? (
                        <div className="text-center py-4 text-gray-500">
                          No users found
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          Type to search for users
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-600 hover:bg-gray-100" 
                  title="Video Call"
                  onClick={() => {
                    // For demo, start video call with first other member
                    const otherMember = activeChannel?.members.find(m => m.userId !== '1');
                    if (otherMember) {
                      startCall('video', otherMember.userId, otherMember.name);
                    } else {
                      toast.error('No one to call');
                    }
                  }}
                  disabled={!!activeCall}
                >
                  <Video className="h-5 w-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-600 hover:bg-gray-100" 
                  title="Voice Call"
                  onClick={() => {
                    // For demo, start voice call with first other member
                    const otherMember = activeChannel?.members.find(m => m.userId !== '1');
                    if (otherMember) {
                      startCall('voice', otherMember.userId, otherMember.name);
                    } else {
                      toast.error('No one to call');
                    }
                  }}
                  disabled={!!activeCall}
                >
                  <Phone className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-100" title="Channel Settings" onClick={openChannelSettings}>
                  <FolderOpen className="h-5 w-5" />
                </Button>
                
                {/* Message Search */}
                <Popover open={showMessageSearch} onOpenChange={setShowMessageSearch}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-100" title="Search Messages">
                      <Search className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-3">
                      <div className="font-medium">Search Messages</div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          value={messageSearchQuery}
                          onChange={(e) => setMessageSearchQuery(e.target.value)}
                          placeholder="Search in conversation..."
                          className="pl-9"
                        />
                      </div>
                      <ScrollArea className="h-60">
                        {searchingMessages ? (
                          <div className="text-center py-4 text-gray-500">Searching...</div>
                        ) : messageSearchResults.length > 0 ? (
                          <div className="space-y-2">
                            {messageSearchResults.map(msg => (
                              <div
                                key={msg.id}
                                className="p-2 rounded hover:bg-gray-100 cursor-pointer"
                                onClick={() => {
                                  // Scroll to message (in production)
                                  setShowMessageSearch(false);
                                  toast.info('Scrolling to message...');
                                }}
                              >
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>{msg.userName}</span>
                                  <span>•</span>
                                  <span>{new Date(msg.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm line-clamp-2">{msg.body}</p>
                              </div>
                            ))}
                          </div>
                        ) : messageSearchQuery ? (
                          <div className="text-center py-4 text-gray-500">No messages found</div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">Type to search</div>
                        )}
                      </ScrollArea>
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-100">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-gray-50 relative">
              <div 
                {...getRootProps()} 
                className={`absolute inset-0 z-10 transition-colors ${
                  isDragActive 
                    ? 'bg-pulse-forest/10 border-4 border-dashed border-pulse-forest' 
                    : ''
                }`}
              >
                <input {...getInputProps()} />
                {isDragActive && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Paperclip className="h-12 w-12 text-pulse-forest mx-auto mb-2" />
                      <p className="text-lg font-semibold text-pulse-forest">Drop files here</p>
                      <p className="text-sm text-gray-600">Images, videos, audio, documents up to 50MB</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="max-w-4xl mx-auto py-4 px-3 sm:py-6 sm:px-4">
                {groupedMessages.map((group: MessageGroup, groupIndex: number) => (
                  <div key={group.date}>
                    {/* Date header */}
                    <div className="text-center py-3 mb-4">
                      <span className="text-gray-500 text-xs font-medium px-3 py-1">
                        {group.label}
                      </span>
                    </div>
                    
                    {/* Messages for this date group */}
                    {group.messages.map((msg: Message, index: number) => (
                  <div
                    key={msg.id}
                    className={`flex mb-4 group ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xl sm:max-w-lg ${msg.isOwn ? 'order-2' : 'order-1'}`}>
                      {!msg.isOwn && (
                        <div className="flex items-center gap-2 mb-2 ml-1">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={msg.userAvatar} />
                            <AvatarFallback className="bg-pulse-700 text-white text-xs">
                              {msg.userName?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-gray-700 text-xs font-medium">{msg.userName}</span>
                        </div>
                      )}
                      
                      {/* Editing mode */}
                      {editingMessageId === msg.id ? (
                        <div className="flex flex-col gap-2">
                          <Input
                            value={editingMessageBody}
                            onChange={(e) => setEditingMessageBody(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleEditMessage(msg.id)}
                            className="bg-white"
                            autoFocus
                          />
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={cancelEditing}>
                              <X className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                            <Button size="sm" onClick={() => handleEditMessage(msg.id)} className="bg-pulse-forest text-white">
                              <Check className="h-4 w-4 mr-1" /> Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          {/* Message actions - show on hover */}
                          <div className={`absolute -top-3 ${msg.isOwn ? '-left-24' : '-right-24'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white shadow-md rounded-full px-1 py-0.5`}>
                            {/* Quick reactions */}
                            {REACTION_EMOJIS.slice(0, 4).map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => handleAddReaction(msg.id, emoji)}
                                className="hover:bg-gray-100 rounded p-1 text-sm"
                                title={`React with ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                            
                            {/* More reactions */}
                            <Popover open={emojiPickerForMessage === msg.id} onOpenChange={(open) => setEmojiPickerForMessage(open ? msg.id : null)}>
                              <PopoverTrigger asChild>
                                <button className="hover:bg-gray-100 rounded p-1">
                                  <Smile className="h-4 w-4 text-gray-500" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-2" align="start">
                                <div className="grid grid-cols-8 gap-1">
                                  {REACTION_EMOJIS.map(emoji => (
                                    <button
                                      key={emoji}
                                      onClick={() => handleAddReaction(msg.id, emoji)}
                                      className="hover:bg-gray-100 rounded p-1 text-lg"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                            
                            {/* Reply */}
                            <button
                              onClick={() => startReply(msg)}
                              className="hover:bg-gray-100 rounded p-1"
                              title="Reply"
                            >
                              <Reply className="h-4 w-4 text-gray-500" />
                            </button>
                            
                            {/* Thread */}
                            <button
                              onClick={() => openThread(msg)}
                              className="hover:bg-gray-100 rounded p-1"
                              title="Start thread"
                            >
                              <MessageSquare className="h-4 w-4 text-gray-500" />
                            </button>
                            
                            {/* Forward */}
                            <button
                              onClick={() => openForwardDialog(msg)}
                              className="hover:bg-gray-100 rounded p-1"
                              title="Forward message"
                            >
                              <Forward className="h-4 w-4 text-gray-500" />
                            </button>
                            
                            {/* More options */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="hover:bg-gray-100 rounded p-1">
                                  <MoreVertical className="h-4 w-4 text-gray-500" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => copyMessageToClipboard(msg)}>
                                  <Copy className="h-4 w-4 mr-2" /> Copy text
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openForwardDialog(msg)}>
                                  <Forward className="h-4 w-4 mr-2" /> Forward
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleTogglePin(msg.id, !!(msg.pins && msg.pins.length > 0))}>
                                  <Pin className="h-4 w-4 mr-2" /> {msg.pins && msg.pins.length > 0 ? 'Unpin' : 'Pin'}
                                </DropdownMenuItem>
                                {msg.isOwn && (
                                  <>
                                    <DropdownMenuItem onClick={() => startEditingMessage(msg)}>
                                      <Edit2 className="h-4 w-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteMessage(msg.id)} className="text-red-600">
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                          <div
                            className={`relative px-4 py-3 rounded-lg ${
                              msg.isOwn
                                ? 'bg-pulse-forest text-white rounded-br-md'
                                : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md shadow-sm'
                            }`}
                          >
                            {/* Render message body with @mention highlighting and inline media */}
                            <div className="text-sm break-words leading-relaxed">
                              {msg.body.split(/(\!\[[^\]]*\]\([^)]+\)|@\[[^\]]+\]\([^)]+\)|(https?:\/\/[^\s]+))/).map((part, i) => {
                                // Check for inline image/GIF markdown: ![alt](url)
                                const imageMatch = part.match(/\!\[([^\]]*)\]\(([^)]+)\)/);
                                if (imageMatch) {
                                  const [, alt, url] = imageMatch;
                                  return (
                                    <img
                                      key={i}
                                      src={url}
                                      alt={alt || 'Image'}
                                      className="max-w-full max-h-64 rounded-lg mt-2 cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => setPreviewImage(url)}
                                    />
                                  );
                                }
                                
                                // Check for @mention
                                const mentionMatch = part.match(/@\[([^\]]+)\]\(([^)]+)\)/);
                                if (mentionMatch) {
                                  return (
                                    <span key={i} className={`font-semibold ${msg.isOwn ? 'text-green-200' : 'text-pulse-forest'}`}>
                                      @{mentionMatch[1]}
                                    </span>
                                  );
                                }
                                
                                // Check for URLs
                                if (part.match(/^https?:\/\//)) {
                                  // Check if it's a direct image URL
                                  if (isImageUrl(part)) {
                                    return (
                                      <img
                                        key={i}
                                        src={part}
                                        alt="Shared image"
                                        className="max-w-full max-h-64 rounded-lg mt-2 cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => setPreviewImage(part)}
                                      />
                                    );
                                  }
                                  // Check if it's a video URL
                                  if (isVideoUrl(part)) {
                                    return (
                                      <video
                                        key={i}
                                        src={part}
                                        controls
                                        className="max-w-full max-h-64 rounded-lg mt-2"
                                      />
                                    );
                                  }
                                  // Check if it's a YouTube URL
                                  const youtubeMatch = part.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
                                  if (youtubeMatch) {
                                    return (
                                      <div key={i} className="mt-2">
                                        <iframe
                                          width="100%"
                                          height="200"
                                          src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
                                          frameBorder="0"
                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                          allowFullScreen
                                          className="rounded-lg"
                                        />
                                      </div>
                                    );
                                  }
                                  // Regular link
                                  return (
                                    <a
                                      key={i}
                                      href={part}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`underline ${msg.isOwn ? 'text-green-200 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
                                    >
                                      {part.length > 50 ? part.substring(0, 50) + '...' : part}
                                    </a>
                                  );
                                }
                                
                                return part;
                              })}
                            </div>
                            
                            {/* Attachments with rich previews */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {msg.attachments.map((att, i) => {
                                  // Image attachment
                                  if (att.mimetype.startsWith('image/')) {
                                    return (
                                      <div key={i} className="relative group">
                                        <img
                                          src={att.url}
                                          alt={att.filename}
                                          className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => setPreviewImage(att.url)}
                                        />
                                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <a
                                            href={att.url}
                                            download={att.filename}
                                            className="bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <Download className="h-4 w-4" />
                                          </a>
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  // Video attachment
                                  if (att.mimetype.startsWith('video/')) {
                                    return (
                                      <video
                                        key={i}
                                        src={att.url}
                                        controls
                                        className="max-w-full max-h-64 rounded-lg"
                                      />
                                    );
                                  }
                                  
                                  // Audio attachment (including voice messages)
                                  if (att.mimetype.startsWith('audio/')) {
                                    return (
                                      <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${msg.isOwn ? 'bg-green-700' : 'bg-gray-100'}`}>
                                        <Mic className={`h-5 w-5 ${msg.isOwn ? 'text-green-200' : 'text-gray-500'}`} />
                                        <audio src={att.url} controls className="h-8 flex-1" />
                                      </div>
                                    );
                                  }
                                  
                                  // Other file types
                                  return (
                                    <a
                                      key={i}
                                      href={att.url}
                                      download={att.filename}
                                      className={`flex items-center gap-2 p-2 rounded-lg ${msg.isOwn ? 'bg-green-700 hover:bg-green-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                                    >
                                      <FileText className={`h-5 w-5 ${msg.isOwn ? 'text-green-200' : 'text-gray-500'}`} />
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-sm truncate ${msg.isOwn ? 'text-white' : 'text-gray-900'}`}>
                                          {att.filename}
                                        </p>
                                        <p className={`text-xs ${msg.isOwn ? 'text-green-200' : 'text-gray-500'}`}>
                                          {(att.size / 1024).toFixed(1)} KB
                                        </p>
                                      </div>
                                      <Download className={`h-4 w-4 ${msg.isOwn ? 'text-green-200' : 'text-gray-500'}`} />
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs ${msg.isOwn ? 'text-green-100' : 'text-gray-500'}`}>
                                  {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                {msg.isEdited && (
                                  <span className={`text-xs italic ${msg.isOwn ? 'text-green-200' : 'text-gray-400'}`}>
                                    (edited)
                                  </span>
                                )}
                              </div>
                              {msg.isOwn && (
                                <div className="ml-2">
                                  {msg.reads && msg.reads.length > 0 ? (
                                    <CheckCheck className={`h-4 w-4 ${msg.isOwn ? 'text-green-200' : 'text-blue-500'}`} />
                                  ) : (
                                    <Check className={`h-4 w-4 ${msg.isOwn ? 'text-green-300' : 'text-gray-400'}`} />
                                  )}
                                </div>
                              )}
                            </div>
                            {msg.pins && msg.pins.length > 0 && (
                              <div className="absolute -top-2 -right-2">
                                <Badge variant="secondary" className="text-xs bg-pulse-500 text-white">
                                  <Pin className="h-3 w-3 mr-1" />
                                </Badge>
                              </div>
                            )}
                          </div>
                          
                          {/* Reactions display */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {msg.reactions.map((reaction, idx) => (
                                <Tooltip key={idx}>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handleAddReaction(msg.id, reaction.emoji)}
                                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                                        reaction.users.some(u => u.id === 'demo-user')
                                          ? 'bg-blue-50 border-blue-200'
                                          : 'bg-gray-50 border-gray-200'
                                      } hover:bg-gray-100`}
                                    >
                                      <span>{reaction.emoji}</span>
                                      <span className="text-gray-600">{reaction.count}</span>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {reaction.users.map(u => u.name).join(', ')}
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </div>
                          )}
                          
                          {/* Thread indicator */}
                          {msg.threadCount && msg.threadCount > 0 && (
                            <button
                              onClick={() => openThread(msg)}
                              className="flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline"
                            >
                              <MessageSquare className="h-3 w-3" />
                              {msg.threadCount} {msg.threadCount === 1 ? 'reply' : 'replies'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  ))}
                  </div>
                ))}
                
                {/* Typing indicator */}
                {activeChannelId && typingUsers[activeChannelId]?.length > 0 && (
                  <div className="flex items-center gap-3 text-gray-600 text-sm ml-2 py-2 px-3 bg-white rounded-lg shadow-sm border border-gray-100 max-w-fit">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-pulse-forest rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-pulse-forest rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-pulse-forest rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="font-medium">
                      {typingUserNames[activeChannelId]?.length > 0 
                        ? typingUserNames[activeChannelId].length === 1 
                          ? `${typingUserNames[activeChannelId][0]} is typing...`
                          : typingUserNames[activeChannelId].length === 2
                          ? `${typingUserNames[activeChannelId].join(' and ')} are typing...`
                          : `${typingUserNames[activeChannelId].slice(0, 2).join(', ')} and ${typingUserNames[activeChannelId].length - 2} more are typing...`
                        : typingUsers[activeChannelId].length === 1 
                        ? 'Someone is typing...'
                        : `${typingUsers[activeChannelId].length} people are typing...`
                      }
                    </span>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
              {/* Reply indicator */}
              {replyingTo && (
                <div className="max-w-4xl mx-auto mb-3 flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
                  <Reply className="h-4 w-4 text-gray-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">Replying to {replyingTo.userName}</p>
                    <p className="text-sm truncate">{replyingTo.body}</p>
                  </div>
                  <button onClick={cancelReply} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              
              {/* Pending attachments preview */}
              {pendingAttachments.length > 0 && (
                <div className="max-w-4xl mx-auto mb-3 flex flex-wrap gap-2">
                  {pendingAttachments.map((att, index) => (
                    <div key={index} className="relative group">
                      {att.mimetype.startsWith('image/') ? (
                        <div className="relative">
                          <img 
                            src={att.url} 
                            alt={att.filename}
                            className="h-16 w-16 object-cover rounded-lg"
                          />
                          <button
                            onClick={() => removePendingAttachment(index)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : att.mimetype.startsWith('video/') ? (
                        <div className="relative">
                          <video 
                            src={att.url}
                            className="h-16 w-16 object-cover rounded-lg"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                            <Video className="h-6 w-6 text-white" />
                          </div>
                          <button
                            onClick={() => removePendingAttachment(index)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : att.mimetype.startsWith('audio/') ? (
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-sm">
                          <Mic className="h-4 w-4 text-gray-500" />
                          <span className="truncate max-w-[100px]">{att.filename}</span>
                          <button
                            onClick={() => removePendingAttachment(index)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-sm">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="truncate max-w-[100px]">{att.filename}</span>
                          <button
                            onClick={() => removePendingAttachment(index)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center gap-2 sm:gap-3 max-w-4xl mx-auto relative">
                {/* File upload button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  multiple
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar,.7z"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <div className="h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Paperclip className="h-5 w-5" />
                  )}
                </Button>
                
                <div className="flex-1 relative">
                  {/* @Mention popup */}
                  {showMentionPopup && mentionResults.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {mentionResults.map(user => (
                        <button
                          key={user.id}
                          onClick={() => insertMention(user)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-pulse-forest text-white text-xs">
                              {user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{user.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <Input
                    value={newMessage}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Type your message... (use @ to mention)"
                    className="bg-gray-50 border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-pulse-forest focus:border-transparent"
                  />
                </div>
                
                {/* Emoji Picker */}
                <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    >
                      <Smile className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <Tabs defaultValue="Smileys" className="w-full">
                      <TabsList className="w-full justify-start overflow-x-auto flex-nowrap px-2 py-1">
                        {Object.keys(EMOJI_CATEGORIES).map(category => (
                          <TabsTrigger key={category} value={category} className="text-xs px-2">
                            {category === 'Smileys' ? '😀' : 
                             category === 'Gestures' ? '👍' :
                             category === 'Hearts' ? '❤️' :
                             category === 'Animals' ? '🐶' :
                             category === 'Food' ? '🍎' :
                             category === 'Objects' ? '💡' : '✅'}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                        <TabsContent key={category} value={category} className="p-2 m-0">
                          <ScrollArea className="h-48">
                            <div className="grid grid-cols-8 gap-1">
                              {emojis.map((emoji, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => insertEmoji(emoji)}
                                  className="hover:bg-gray-100 rounded p-1 text-xl"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </PopoverContent>
                </Popover>
                
                {/* GIF Picker */}
                <Popover open={showGifPicker} onOpenChange={setShowGifPicker}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      title="Send GIF"
                    >
                      <span className="text-xs font-bold">GIF</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          value={gifSearchQuery}
                          onChange={(e) => setGifSearchQuery(e.target.value)}
                          placeholder="Search GIFs..."
                          className="pl-8 h-8"
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-64 p-2">
                      {loadingGifs ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="w-6 h-6 border-2 border-pulse-forest border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {gifResults.map(gif => (
                            <button
                              key={gif.id}
                              onClick={() => selectGif(gif)}
                              className="relative overflow-hidden rounded-lg hover:ring-2 hover:ring-pulse-forest transition-all"
                            >
                              <img
                                src={gif.preview}
                                alt={gif.title}
                                className="w-full h-24 object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                    <div className="p-2 border-t text-center text-xs text-gray-400">
                      Powered by GIPHY
                    </div>
                  </PopoverContent>
                </Popover>
                
                {/* Mention button */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  onClick={() => {
                    setNewMessage(prev => prev + '@');
                    setShowMentionPopup(true);
                  }}
                >
                  <AtSign className="h-5 w-5" />
                </Button>
                
                {/* Voice Message */}
                {isRecording ? (
                  <div className="flex items-center gap-2 bg-red-50 px-3 py-1 rounded-full">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm text-red-600 font-medium">{formatRecordingTime(recordingTime)}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                      onClick={stopRecording}
                      title="Stop recording"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      onClick={cancelRecording}
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : audioUrl ? (
                  <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full">
                    <audio src={audioUrl} controls className="h-8 w-32" />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                      onClick={sendVoiceMessage}
                      title="Send voice message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      onClick={cancelRecording}
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    onClick={startRecording}
                    title="Record voice message"
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                )}
                
                {/* Schedule Message */}
                <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      title="Schedule message"
                    >
                      <Clock className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white">
                    <DialogHeader>
                      <DialogTitle>Schedule Message</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium">Message</label>
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type your message..."
                          className="mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Date</label>
                          <Input
                            type="date"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Time</label>
                          <Input
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      {scheduledMessages.length > 0 && (
                        <div>
                          <label className="text-sm font-medium">Scheduled Messages</label>
                          <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                            {scheduledMessages
                              .filter(s => s.channelId === activeChannelId)
                              .map(s => (
                                <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                  <div>
                                    <p className="truncate max-w-[200px]">{s.body}</p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(s.scheduledFor).toLocaleString()}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => setScheduledMessages(prev => prev.filter(m => m.id !== s.id))}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      <Button
                        onClick={handleScheduleMessage}
                        className="w-full bg-pulse-forest hover:bg-pulse-forest-dark text-white"
                        disabled={!newMessage.trim() || !scheduleDate || !scheduleTime}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Schedule Message
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!newMessage.trim() && pendingAttachments.length === 0}
                  className="bg-pulse-forest hover:bg-pulse-forest-light text-white rounded-lg px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-md">
              <div className="bg-pulse-forest rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center shadow-lg">
                <MessageSquare className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">Team Chat</h3>
              <p className="text-gray-600 mb-4">Select a conversation to start messaging your team</p>
              <p className="text-gray-500 text-sm">Collaborate with your team in real-time to manage farm operations efficiently.</p>
            </div>
          </div>
        )}
      </div>

      {/* Thread Panel */}
      {showThread && threadParentMessage && (
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          {/* Thread Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Thread</h3>
              <p className="text-xs text-gray-500">
                {threadParentMessage.userName} • {new Date(threadParentMessage.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => {
                setShowThread(false);
                setThreadParentMessage(null);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Parent Message */}
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-start gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-pulse-forest text-white text-xs">
                  {threadParentMessage.userName?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{threadParentMessage.userName}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(threadParentMessage.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <p className="text-sm mt-1">{threadParentMessage.body}</p>
              </div>
            </div>
          </div>

          {/* Thread Messages */}
          <ScrollArea className="flex-1 p-4">
            {threadMessages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No replies yet</p>
                <p className="text-xs">Be the first to reply!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {threadMessages.map(msg => (
                  <div key={msg.id} className="flex items-start gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-pulse-700 text-white text-xs">
                        {msg.userName?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{msg.userName}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{msg.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Thread Reply Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Reply in thread..."
                className="flex-1"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                    const newReply: Message = {
                      id: `thread-${Date.now()}`,
                      userId: 'demo-user',
                      userName: 'You',
                      body: (e.target as HTMLInputElement).value,
                      createdAt: new Date().toISOString(),
                      reads: [],
                      isOwn: true,
                    };
                    setThreadMessages(prev => [...prev, newReply]);
                    (e.target as HTMLInputElement).value = '';
                    toast.success('Reply sent');
                  }
                }}
              />
              <Button size="icon" className="bg-pulse-forest hover:bg-pulse-forest-dark text-white">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Online Users Panel (collapsible) */}
      <div className="w-64 bg-gray-50 border-l border-gray-200 hidden lg:flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-sm">Team Members</h3>
        </div>
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {onlineUsers.map(user => (
              <div
                key={user.id}
                className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer"
              >
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-pulse-forest text-white text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-50 ${getStatusColor(user.status)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user.status === 'offline' && user.lastSeen
                      ? `Last seen ${new Date(user.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                      : user.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <a
                href={previewImage}
                download
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-4 w-4" />
                Download
              </a>
              <a
                href={previewImage}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                Open in new tab
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Forward Message Dialog */}
      <Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Forward Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Message preview */}
            {messageToForward && (
              <div className="p-3 bg-gray-50 rounded-lg border">
                <p className="text-xs text-gray-500 mb-1">Message from {messageToForward.userName}</p>
                <p className="text-sm line-clamp-3">{messageToForward.body}</p>
              </div>
            )}
            
            {/* Channel selection */}
            <div>
              <p className="text-sm font-medium mb-2">Select destination</p>
              <ScrollArea className="h-64">
                <div className="space-y-1">
                  {channels
                    .filter(c => c.id !== activeChannelId)
                    .map(channel => {
                      const displayName = channel.name || channel.members.map(m => m.name).join(', ');
                      return (
                        <button
                          key={channel.id}
                          onClick={() => forwardMessage(channel.id)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 text-left"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-pulse-forest text-white text-xs">
                              {displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{displayName}</p>
                            <p className="text-xs text-gray-500">
                              {channel.type === 'direct' ? 'Direct message' : `${channel.members.length} members`}
                            </p>
                          </div>
                          <Forward className="h-4 w-4 text-gray-400" />
                        </button>
                      );
                    })}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Channel Settings Dialog */}
      <Dialog open={showChannelSettings} onOpenChange={setShowChannelSettings}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Channel Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Channel Description */}
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={channelDescription}
                onChange={(e) => setChannelDescription(e.target.value)}
                placeholder="What's this channel about?"
                className="mt-1"
              />
            </div>

            {/* Channel Type */}
            <div>
              <label className="text-sm font-medium">Channel Type</label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={channelIsPublic}
                  onChange={(e) => setChannelIsPublic(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="isPublic" className="text-sm">
                  Public channel (anyone can join)
                </label>
              </div>
            </div>

            {/* Channel Members */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Members</label>
                <span className="text-xs text-gray-500">
                  {activeChannel?.members.length} members
                </span>
              </div>
              <ScrollArea className="h-48 border rounded-lg p-2">
                <div className="space-y-1">
                  {activeChannel?.members.map(member => {
                    const isAdmin = activeChannel.adminUserIds?.includes(member.userId) || 
                                  activeChannel.createdById === member.userId;
                    const isCurrentUser = member.userId === '1'; // Assuming current user ID is '1'
                    const canRemoveUser = isChannelAdmin(activeChannel) && !isAdmin && !isCurrentUser;
                    
                    return (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-pulse-forest text-white text-xs">
                              {member.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{member.name}</p>
                            {isAdmin && (
                              <p className="text-xs text-pulse-forest">Admin</p>
                            )}
                          </div>
                        </div>
                        {canRemoveUser && (
                          <button
                            onClick={() => removeUserFromChannel(member.userId, member.name)}
                            className="text-red-500 hover:text-red-700"
                            title="Remove from channel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Channel Actions */}
            <div className="space-y-2 pt-2 border-t">
              {isChannelAdmin(activeChannel!) && (
                <Button
                  onClick={toggleArchiveChannel}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  {activeChannel?.isArchived ? 'Unarchive Channel' : 'Archive Channel'}
                </Button>
              )}
              
              {!isChannelAdmin(activeChannel!) && activeChannel?.type !== 'direct' && (
                <Button
                  onClick={leaveChannel}
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4 mr-2" />
                  Leave Channel
                </Button>
              )}
            </div>

            {/* Save Button */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowChannelSettings(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={updateChannelSettings}
                className="flex-1 bg-pulse-forest hover:bg-pulse-forest-dark text-white"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Incoming Call Dialog */}
      {incomingCall && (
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="bg-white max-w-sm">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  incomingCall.type === 'video' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  {incomingCall.type === 'video' ? (
                    <Video className="h-8 w-8 text-blue-600" />
                  ) : (
                    <Phone className="h-8 w-8 text-green-600" />
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-lg">
                  {incomingCall.type === 'video' ? 'Video' : 'Voice'} Call
                </h3>
                <p className="text-gray-600">{incomingCall.remoteUserName} is calling you</p>
              </div>

              <div className="flex gap-3 justify-center">
                <Button
                  onClick={rejectCall}
                  variant="outline"
                  className="bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                >
                  <X className="h-4 w-4 mr-2" />
                  Decline
                </Button>
                <Button
                  onClick={acceptCall}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Accept
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Active Call UI */}
      {activeCall && (
        <div className={`fixed inset-0 bg-black z-50 flex flex-col ${
          isCallMinimized ? 'h-auto top-4 right-4 w-80 rounded-lg shadow-2xl' : ''
        }`}>
          {!isCallMinimized ? (
            <>
              {/* Full Screen Call */}
              <div className="flex-1 relative">
                {/* Remote Video */}
                {activeCall.type === 'video' && activeCall.remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    <div className="text-center">
                      <Avatar className="w-24 h-24 mx-auto mb-4">
                        <AvatarFallback className="bg-pulse-forest text-white text-3xl">
                          {activeCall.remoteUserName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="text-white text-xl font-semibold">{activeCall.remoteUserName}</h3>
                      <p className="text-gray-300 mt-2">
                        {activeCall.status === 'ringing' && 'Ringing...'}
                        {activeCall.status === 'connecting' && 'Connecting...'}
                        {activeCall.status === 'connected' && 'Connected'}
                        {activeCall.startTime && (
                          <span className="block text-sm mt-1">
                            {Math.floor((Date.now() - activeCall.startTime.getTime()) / 60000)}:
                            {String(Math.floor(((Date.now() - activeCall.startTime.getTime()) % 60000) / 1000)).padStart(2, '0')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Local Video (picture-in-picture) */}
                {activeCall.type === 'video' && activeCall.localStream && (
                  <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Minimize Button */}
                <button
                  onClick={() => setIsCallMinimized(true)}
                  className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>

              {/* Call Controls */}
              <div className="bg-gray-900 p-4">
                <div className="flex justify-center gap-4">
                  {/* Mute/Unmute */}
                  <button
                    onClick={toggleMute}
                    className={`p-3 rounded-full transition-colors ${
                      isMuted 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>

                  {/* Video On/Off (video calls only) */}
                  {activeCall.type === 'video' && (
                    <button
                      onClick={toggleVideo}
                      className={`p-3 rounded-full transition-colors ${
                        isVideoOff 
                          ? 'bg-red-600 hover:bg-red-700 text-white' 
                          : 'bg-gray-700 hover:bg-gray-600 text-white'
                      }`}
                    >
                      {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                    </button>
                  )}

                  {/* Screen Share (video calls only) */}
                  {activeCall.type === 'video' && (
                    <button
                      onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                      className={`p-3 rounded-full transition-colors ${
                        isScreenSharing 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-gray-700 hover:bg-gray-600 text-white'
                      }`}
                    >
                      <Monitor className="h-5 w-5" />
                    </button>
                  )}

                  {/* End Call */}
                  <button
                    onClick={endCall}
                    className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
                  >
                    <Phone className="h-5 w-5 transform rotate-135" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Minimized Call */}
              <div className="bg-gray-900 p-3 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      activeCall.type === 'video' ? 'bg-blue-600' : 'bg-green-600'
                    }`}>
                      {activeCall.type === 'video' ? (
                        <Video className="h-4 w-4 text-white" />
                      ) : (
                        <Phone className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{activeCall.remoteUserName}</p>
                      {activeCall.startTime && (
                        <p className="text-gray-400 text-xs">
                          {Math.floor((Date.now() - activeCall.startTime.getTime()) / 60000)}:
                          {String(Math.floor(((Date.now() - activeCall.startTime.getTime()) % 60000) / 1000)).padStart(2, '0')}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {/* Mute indicator */}
                    {isMuted && (
                      <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                        <VolumeX className="h-3 w-3 text-white" />
                      </div>
                    )}
                    
                    {/* Expand button */}
                    <button
                      onClick={() => setIsCallMinimized(false)}
                      className="text-white hover:text-gray-300 p-1"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                    
                    {/* End call */}
                    <button
                      onClick={endCall}
                      className="text-red-500 hover:text-red-400 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
