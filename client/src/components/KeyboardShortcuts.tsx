import React, { useState, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Command } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, HelpCircle, MessageSquare, ChevronLeft, ChevronRight, Send, X, Keyboard, Sun, Moon } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { toggleTheme } from '@/lib/darkmode';

interface ShortcutAction {
  id: string;
  label: string;
  description: string;
  shortcut: string;
  action: () => void;
  category: 'navigation' | 'chat' | 'general';
}

export function KeyboardShortcuts() {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [, navigate] = useLocation();

  // Navigation shortcuts
  const goToChat = useCallback(() => {
    navigate('/app/chat');
    toast.success('Navigated to Chat');
  }, [navigate]);

  const goToDashboard = useCallback(() => {
    navigate('/app');
    toast.success('Navigated to Dashboard');
  }, [navigate]);

  const goToSettings = useCallback(() => {
    navigate('/app/settings');
    toast.success('Navigated to Settings');
  }, [navigate]);

  // Chat shortcuts
  const createNewChat = useCallback(() => {
    navigate('/app/chat');
    toast.success('Create new chat - Click on "New Chat" button');
  }, [navigate]);

  const nextChannel = useCallback(() => {
    toast.success('Next channel - Feature coming soon');
  }, []);

  const previousChannel = useCallback(() => {
    toast.success('Previous channel - Feature coming soon');
  }, []);

  // General shortcuts
  const closeModals = useCallback(() => {
    setShowCommandPalette(false);
    setShowHelpDialog(false);
    // Close other modals if needed
  }, []);

  const toggleThemeShortcut = useCallback(() => {
    toggleTheme();
    toast.success('Theme toggled');
  }, []);

  const openCommandPalette = useCallback(() => {
    setShowCommandPalette(true);
    setSearchQuery('');
  }, []);

  const openHelpDialog = useCallback(() => {
    setShowHelpDialog(true);
  }, []);

  // Define all shortcut actions
  const actions: ShortcutAction[] = [
    {
      id: 'go-to-chat',
      label: 'Go to Chat',
      description: 'Navigate to the chat page',
      shortcut: 'mod+shift+c',
      action: goToChat,
      category: 'navigation'
    },
    {
      id: 'go-to-dashboard',
      label: 'Go to Dashboard',
      description: 'Navigate to the dashboard',
      shortcut: 'mod+d',
      action: goToDashboard,
      category: 'navigation'
    },
    {
      id: 'go-to-settings',
      label: 'Go to Settings',
      description: 'Navigate to settings page',
      shortcut: 'mod+,',
      action: goToSettings,
      category: 'navigation'
    },
    {
      id: 'new-chat',
      label: 'New Chat',
      description: 'Create a new chat conversation',
      shortcut: 'mod+n',
      action: createNewChat,
      category: 'chat'
    },
    {
      id: 'next-channel',
      label: 'Next Channel',
      description: 'Switch to next channel',
      shortcut: 'mod+shift+.',
      action: nextChannel,
      category: 'chat'
    },
    {
      id: 'previous-channel',
      label: 'Previous Channel',
      description: 'Switch to previous channel',
      shortcut: 'mod+shift+,',
      action: previousChannel,
      category: 'chat'
    },
    {
      id: 'command-palette',
      label: 'Command Palette',
      description: 'Open command palette for quick actions',
      shortcut: 'mod+k',
      action: openCommandPalette,
      category: 'general'
    },
    {
      id: 'help-dialog',
      label: 'Keyboard Shortcuts Help',
      description: 'Show all available keyboard shortcuts',
      shortcut: 'mod+/',
      action: openHelpDialog,
      category: 'general'
    },
    {
      id: 'toggle-theme',
      label: 'Toggle Theme',
      description: 'Switch between light and dark mode',
      shortcut: 'mod+shift+t',
      action: toggleThemeShortcut,
      category: 'general'
    },
    {
      id: 'close-modals',
      label: 'Close Modals',
      description: 'Close any open modals or dialogs',
      shortcut: 'escape',
      action: closeModals,
      category: 'general'
    }
  ];

  // Register hotkeys
  useHotkeys('mod+k', openCommandPalette, { enableOnFormTags: true });
  useHotkeys('mod+n', createNewChat, { enableOnFormTags: true });
  useHotkeys('mod+/', openHelpDialog, { enableOnFormTags: true });
  useHotkeys('escape', closeModals);
  useHotkeys('mod+d', goToDashboard, { enableOnFormTags: true });
  useHotkeys('mod+,', goToSettings, { enableOnFormTags: true });
  useHotkeys('mod+shift+c', goToChat, { enableOnFormTags: true });
  useHotkeys('mod+shift+.', nextChannel, { enableOnFormTags: true });
  useHotkeys('mod+shift+,', previousChannel, { enableOnFormTags: true });
  useHotkeys('mod+shift+t', toggleThemeShortcut, { enableOnFormTags: true });

  // Filter actions based on search query
  const filteredActions = actions.filter(action =>
    action.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    action.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group actions by category
  const groupedActions = filteredActions.reduce((groups, action) => {
    if (!groups[action.category]) {
      groups[action.category] = [];
    }
    groups[action.category].push(action);
    return groups;
  }, {} as Record<string, ShortcutAction[]>);

  const handleActionSelect = (action: ShortcutAction) => {
    action.action();
    setShowCommandPalette(false);
  };

  // Command Palette Component
  const CommandPalette = () => (
    <Dialog open={showCommandPalette} onOpenChange={setShowCommandPalette}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            Command Palette
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Type a command or search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pulse-forest focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Action groups */}
          <div className="max-h-96 overflow-y-auto space-y-6">
            {Object.entries(groupedActions).map(([category, categoryActions]) => (
              <div key={category}>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </h3>
                <div className="space-y-1">
                  {categoryActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleActionSelect(action)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {action.category === 'navigation' && <ChevronRight className="h-4 w-4 text-gray-400" />}
                          {action.category === 'chat' && <MessageSquare className="h-4 w-4 text-gray-400" />}
                          {action.category === 'general' && <Keyboard className="h-4 w-4 text-gray-400" />}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{action.label}</div>
                          <div className="text-sm text-gray-500">{action.description}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {action.shortcut.replace('mod+', 'Ctrl+').replace('shift+', 'Shift+')}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Press <kbd className="px-2 py-1 text-xs bg-gray-100 rounded">Esc</kbd> to close
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCommandPalette(false);
                setShowHelpDialog(true);
              }}
            >
              <HelpCircle className="h-4 w-4 mr-1" />
              View all shortcuts
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Help Dialog Component
  const HelpDialog = () => (
    <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {Object.entries(groupedActions).map(([category, categoryActions]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </h3>
              <div className="space-y-2">
                {categoryActions.map((action) => (
                  <div key={action.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                    <div>
                      <div className="font-medium text-gray-900">{action.label}</div>
                      <div className="text-sm text-gray-500">{action.description}</div>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {action.shortcut.replace('mod+', 'Ctrl+').replace('shift+', 'Shift+')}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                <strong>Note:</strong> On Mac, use <kbd className="px-2 py-1 text-xs bg-gray-100 rounded">Cmd</kbd> instead of <kbd className="px-2 py-1 text-xs bg-gray-100 rounded">Ctrl</kbd>
              </div>
              <Button variant="outline" onClick={() => setShowHelpDialog(false)}>
                Got it!
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <CommandPalette />
      <HelpDialog />
    </>
  );
}
