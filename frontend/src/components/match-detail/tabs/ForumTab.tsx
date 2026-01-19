/**
 * Forum Tab
 *
 * Shows comments, live chat, and polls for the match
 */

import { useState, useEffect, useRef } from 'react';
import { useMatchDetail } from '../MatchDetailContext';

type ForumSection = 'comments' | 'chat' | 'poll';

interface Comment {
  id: number;
  user_id: string;
  username?: string;
  content: string;
  likes_count: number;
  is_liked_by_me?: boolean;
  created_at: string;
  replies?: Comment[];
}

interface ChatMessage {
  id: number;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
}

interface Poll {
  id: number;
  question: string;
  option_home_votes: number;
  option_draw_votes: number;
  option_away_votes: number;
  total_votes: number;
  my_vote?: 'home' | 'draw' | 'away' | null;
  is_active: boolean;
}

export function ForumTab() {
  const { matchId, match } = useMatchDetail();
  const [activeSection, setActiveSection] = useState<ForumSection>('comments');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Section Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        backgroundColor: 'white',
        padding: '8px',
        borderRadius: '12px'
      }}>
        {[
          { id: 'comments' as ForumSection, label: 'Yorumlar', icon: '💬' },
          { id: 'chat' as ForumSection, label: 'Canli Sohbet', icon: '🗣️' },
          { id: 'poll' as ForumSection, label: 'Anket', icon: '📊' },
        ].map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: activeSection === section.id ? '600' : '400',
              backgroundColor: activeSection === section.id ? '#3b82f6' : 'transparent',
              color: activeSection === section.id ? 'white' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
          >
            <span>{section.icon}</span>
            {section.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSection === 'comments' && <CommentsSection matchId={matchId} />}
      {activeSection === 'chat' && <ChatSection matchId={matchId} />}
      {activeSection === 'poll' && <PollSection matchId={matchId} match={match} />}
    </div>
  );
}

// ============================================
// COMMENTS SECTION
// ============================================

function CommentsSection({ matchId }: { matchId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [matchId]);

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/forum/${matchId}/comments`);
      const data = await response.json();
      setComments(data.data?.comments || []);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/forum/${matchId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() })
      });

      if (response.ok) {
        setNewComment('');
        fetchComments();
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (commentId: number) => {
    try {
      await fetch(`/api/forum/comments/${commentId}/like`, { method: 'POST' });
      fetchComments();
    } catch (err) {
      console.error('Failed to like comment:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        Yorumlar yukleniyor...
      </div>
    );
  }

  return (
    <div>
      {/* Comment Input */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px'
      }}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Yorumunuzu yazin..."
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '14px',
            resize: 'vertical',
            marginBottom: '12px'
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim() || submitting}
          style={{
            padding: '10px 20px',
            backgroundColor: newComment.trim() ? '#3b82f6' : '#d1d5db',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '14px',
            cursor: newComment.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          {submitting ? 'Gonderiliyor...' : 'Yorum Yap'}
        </button>
      </div>

      {/* Comments List */}
      {comments.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#6b7280',
          backgroundColor: 'white',
          borderRadius: '12px'
        }}>
          Henuz yorum yok. Ilk yorumu siz yapin!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {comments.map((comment) => (
            <div
              key={comment.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}>
                  👤
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px'
                  }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: '#1f2937' }}>
                      {comment.username || 'Anonim'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                      {new Date(comment.created_at).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    color: '#374151',
                    lineHeight: '1.5'
                  }}>
                    {comment.content}
                  </p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginTop: '10px'
                  }}>
                    <button
                      onClick={() => handleLike(comment.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: comment.is_liked_by_me ? '#ef4444' : '#6b7280',
                        fontSize: '13px'
                      }}
                    >
                      {comment.is_liked_by_me ? '❤️' : '🤍'} {comment.likes_count || 0}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// CHAT SECTION
// ============================================

function ChatSection({ matchId }: { matchId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [matchId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/forum/${matchId}/chat`);
      const data = await response.json();
      setMessages(data.data?.messages || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/forum/${matchId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage.trim() })
      });

      if (response.ok) {
        setNewMessage('');
        fetchMessages();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        Sohbet yukleniyor...
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '400px'
    }}>
      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            fontSize: '14px'
          }}>
            Henuz mesaj yok. Sohbeti baslatin!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                flexShrink: 0
              }}>
                👤
              </div>
              <div style={{
                backgroundColor: '#f3f4f6',
                padding: '8px 12px',
                borderRadius: '12px',
                maxWidth: '80%'
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#3b82f6',
                  marginBottom: '2px'
                }}>
                  {msg.username}
                </div>
                <div style={{ fontSize: '14px', color: '#1f2937' }}>
                  {msg.message}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        borderTop: '1px solid #e5e7eb'
      }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Mesaj yazin..."
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '20px',
            border: '1px solid #e5e7eb',
            fontSize: '14px',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || submitting}
          style={{
            padding: '10px 20px',
            backgroundColor: newMessage.trim() ? '#3b82f6' : '#d1d5db',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            fontWeight: '600',
            fontSize: '14px',
            cursor: newMessage.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          Gonder
        </button>
      </form>
    </div>
  );
}

// ============================================
// POLL SECTION
// ============================================

// Vote option component - moved outside to prevent re-creation on every render
interface VoteOptionProps {
  label: string;
  teamName?: string;
  votes: number;
  percent: number;
  value: 'home' | 'draw' | 'away';
  color: string;
  myVote?: 'home' | 'draw' | 'away' | null;
  isActive: boolean;
  voting: boolean;
  onVote: (vote: 'home' | 'draw' | 'away') => void;
}

function VoteOption({ label, teamName, votes, percent, value, color, myVote, isActive, voting, onVote }: VoteOptionProps) {
  const isSelected = myVote === value;

  return (
    <button
      onClick={() => onVote(value)}
      disabled={voting || !isActive}
      style={{
        width: '100%',
        padding: '16px',
        backgroundColor: isSelected ? `${color}15` : 'white',
        border: isSelected ? `2px solid ${color}` : '2px solid #e5e7eb',
        borderRadius: '12px',
        cursor: isActive ? 'pointer' : 'default',
        textAlign: 'left',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Progress Background */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: `${percent}%`,
        backgroundColor: `${color}20`,
        transition: 'width 0.3s ease'
      }} />

      {/* Content */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: '600', fontSize: '15px', color: '#1f2937', marginBottom: '4px' }}>
            {teamName || label}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>
            {votes} oy
          </div>
        </div>
        <div style={{ fontSize: '20px', fontWeight: '700', color }}>
          %{percent}
        </div>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: color,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px'
        }}>
          ✓
        </div>
      )}
    </button>
  );
}

function PollSection({ matchId, match }: { matchId: string; match: any }) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    fetchPoll();
  }, [matchId]);

  const fetchPoll = async () => {
    try {
      const response = await fetch(`/api/forum/${matchId}/poll`);
      const data = await response.json();
      setPoll(data.data || null);
    } catch (err) {
      console.error('Failed to fetch poll:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (vote: 'home' | 'draw' | 'away') => {
    if (voting) return;

    setVoting(true);
    try {
      const response = await fetch(`/api/forum/${matchId}/poll/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote })
      });

      if (response.ok) {
        fetchPoll();
      }
    } catch (err) {
      console.error('Failed to vote:', err);
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        Anket yukleniyor...
      </div>
    );
  }

  if (!poll) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: 'white',
        borderRadius: '12px'
      }}>
        Anket bulunamadi.
      </div>
    );
  }

  const total = poll.total_votes || 1;
  const homePercent = Math.round((poll.option_home_votes / total) * 100);
  const drawPercent = Math.round((poll.option_draw_votes / total) * 100);
  const awayPercent = Math.round((poll.option_away_votes / total) * 100);

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px'
    }}>
      {/* Question */}
      <h3 style={{
        margin: '0 0 20px 0',
        fontSize: '18px',
        fontWeight: '700',
        color: '#1f2937',
        textAlign: 'center'
      }}>
        {poll.question}
      </h3>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <VoteOption
          label="Ev Sahibi Kazanir"
          teamName={match?.home_team?.name}
          votes={poll.option_home_votes}
          percent={homePercent}
          value="home"
          color="#3b82f6"
          myVote={poll.my_vote}
          isActive={poll.is_active}
          voting={voting}
          onVote={handleVote}
        />
        <VoteOption
          label="Beraberlik"
          votes={poll.option_draw_votes}
          percent={drawPercent}
          value="draw"
          color="#eab308"
          myVote={poll.my_vote}
          isActive={poll.is_active}
          voting={voting}
          onVote={handleVote}
        />
        <VoteOption
          label="Deplasman Kazanir"
          teamName={match?.away_team?.name}
          votes={poll.option_away_votes}
          percent={awayPercent}
          value="away"
          color="#ef4444"
          myVote={poll.my_vote}
          isActive={poll.is_active}
          voting={voting}
          onVote={handleVote}
        />
      </div>

      {/* Total votes */}
      <div style={{
        marginTop: '16px',
        textAlign: 'center',
        fontSize: '13px',
        color: '#6b7280'
      }}>
        Toplam {poll.total_votes} oy kullanildi
        {!poll.is_active && <span style={{ color: '#ef4444' }}> (Anket kapandi)</span>}
      </div>
    </div>
  );
}

export default ForumTab;
