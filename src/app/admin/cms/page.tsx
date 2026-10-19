'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Globe,
  MessageSquare,
  Image as ImageIcon,
  Sliders,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Star,
  Save,
  RotateCw,
  ExternalLink,
  Megaphone,
  Clock,
  MapPin,
  Phone,
  QrCode,
  Edit2,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function AdminCmsPage() {
  const [activeTab, setActiveTab] = useState<'testimonials' | 'gallery' | 'settings'>('testimonials');
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Testimonials State
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [testiModalOpen, setTestiModalOpen] = useState(false);
  const [editingTesti, setEditingTesti] = useState<any | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newRating, setNewRating] = useState('5');

  // Gallery State
  const [gallery, setGallery] = useState<any[]>([]);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [editingGallery, setEditingGallery] = useState<any | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageAlt, setNewImageAlt] = useState('');
  const [newImageCategory, setNewImageCategory] = useState('gaming');

  // Settings State
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Load Data
  const loadCmsData = async () => {
    setLoading(true);
    try {
      const [testiRes, galRes, setRes] = await Promise.all([
        fetch('/api/admin/cms/testimonials'),
        fetch('/api/admin/cms/gallery'),
        fetch('/api/admin/cms/settings'),
      ]);

      const [testiJson, galJson, setJson] = await Promise.all([
        testiRes.json(),
        galRes.json(),
        setRes.json(),
      ]);

      if (testiJson.success) setTestimonials(testiJson.data || []);
      if (galJson.success) setGallery(galJson.data || []);
      if (setJson.success && Array.isArray(setJson.data)) {
        const map: Record<string, string> = {};
        setJson.data.forEach((s: any) => {
          map[s.key] = s.value;
        });
        setSettings(map);
      }
    } catch {
      toast.error('Failed to load CMS data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCmsData();
  }, []);

  // Testimonial Handlers
  const handleToggleTestimonial = async (id: string, currentApproved: boolean) => {
    try {
      const res = await fetch('/api/admin/cms/testimonials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isApproved: !currentApproved }),
      });
      const json = await res.json();
      if (json.success) {
        setTestimonials((prev) =>
          prev.map((t) => (t.id === id ? { ...t, isApproved: !currentApproved } : t))
        );
        toast.success(`Review ${!currentApproved ? 'approved and published' : 'hidden'}`);
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteTestimonial = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/cms/testimonials?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setTestimonials((prev) => prev.filter((t) => t.id !== id));
        toast.info('Testimonial deleted');
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  const openCreateTestimonial = () => {
    setEditingTesti(null);
    setNewCustomerName('');
    setNewContent('');
    setNewRating('5');
    setTestiModalOpen(true);
  };

  const openEditTestimonial = (t: any) => {
    setEditingTesti(t);
    setNewCustomerName(t.customerName || '');
    setNewContent(t.content || '');
    setNewRating(String(t.rating || 5));
    setTestiModalOpen(true);
  };

  const handleCreateTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCustomerName.trim() || newCustomerName.trim().length < 2) {
      toast.error('Customer name must be at least 2 characters');
      return;
    }

    if (!newContent.trim() || newContent.trim().length < 5) {
      toast.error('Review content must be at least 5 characters');
      return;
    }

    try {
      if (editingTesti) {
        const res = await fetch('/api/admin/cms/testimonials', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingTesti.id,
            customerName: newCustomerName.trim(),
            content: newContent.trim(),
            rating: parseInt(newRating, 10),
          }),
        });
        const json = await res.json();
        if (json.success) {
          setTestimonials((prev) =>
            prev.map((t) => (t.id === editingTesti.id ? json.data : t))
          );
          setTestiModalOpen(false);
          setEditingTesti(null);
          toast.success('Testimonial updated successfully');
        } else {
          toast.error(json.error?.message || 'Failed to update testimonial');
        }
      } else {
        const res = await fetch('/api/admin/cms/testimonials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: newCustomerName.trim(),
            content: newContent.trim(),
            rating: parseInt(newRating, 10),
            isApproved: true,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setTestimonials((prev) => [json.data, ...prev]);
          setTestiModalOpen(false);
          setNewCustomerName('');
          setNewContent('');
          toast.success('Testimonial published successfully');
        } else {
          toast.error(json.error?.message || 'Failed to create testimonial');
        }
      }
    } catch {
      toast.error('Failed to save testimonial');
    }
  };

  // Gallery Handlers
  const openCreateGallery = () => {
    setEditingGallery(null);
    setNewImageUrl('');
    setNewImageAlt('');
    setNewImageCategory('gaming');
    setGalleryModalOpen(true);
  };

  const openEditGallery = (g: any) => {
    setEditingGallery(g);
    setNewImageUrl(g.url || '');
    setNewImageAlt(g.altText || '');
    setNewImageCategory(g.category || 'gaming');
    setGalleryModalOpen(true);
  };

  const handleCreateGallery = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newImageUrl.trim() || (!newImageUrl.startsWith('http://') && !newImageUrl.startsWith('https://') && !newImageUrl.startsWith('/'))) {
      toast.error('Please enter a valid image URL (http/https or relative path)');
      return;
    }

    try {
      if (editingGallery) {
        const res = await fetch('/api/admin/cms/gallery', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingGallery.id,
            url: newImageUrl.trim(),
            altText: newImageAlt.trim(),
            category: newImageCategory,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setGallery((prev) => prev.map((g) => (g.id === editingGallery.id ? json.data : g)));
          setGalleryModalOpen(false);
          setEditingGallery(null);
          toast.success('Gallery photo updated');
        } else {
          toast.error(json.error?.message || 'Failed to update photo');
        }
      } else {
        const res = await fetch('/api/admin/cms/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: newImageUrl.trim(),
            altText: newImageAlt.trim(),
            category: newImageCategory,
            isActive: true,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setGallery((prev) => [json.data, ...prev]);
          setGalleryModalOpen(false);
          setNewImageUrl('');
          setNewImageAlt('');
          toast.success('Photo added to gallery');
        } else {
          toast.error(json.error?.message || 'Failed to add photo');
        }
      }
    } catch {
      toast.error('Failed to save image');
    }
  };

  const handleDeleteGallery = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/cms/gallery?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setGallery((prev) => prev.filter((g) => g.id !== id));
        toast.info('Gallery image deleted');
      }
    } catch {
      toast.error('Failed to remove image');
    }
  };

  // Settings Save Handler
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const payload = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        group: key.startsWith('announcement')
          ? 'announcement'
          : key.startsWith('operating')
          ? 'hours'
          : key.startsWith('social')
          ? 'social'
          : key.startsWith('counter_upi')
          ? 'payment'
          : 'contact',
      }));

      const res = await fetch('/api/admin/cms/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Website configuration saved and live on arena portal!');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-heading font-black uppercase text-ds-text">
              Website CMS & Venue Controls
            </h1>
            <Badge variant="accent" size="sm">
              LIVE PORTAL
            </Badge>
          </div>
          <p className="text-xs text-ds-text-muted mt-0.5">
            Manage customer testimonials, arena photo showcase, operating hours, and top announcement alerts.
          </p>
        </div>

        {/* Tab Switcher & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-ds-surface border border-ds-border text-xs font-heading font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('testimonials')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors ${
                activeTab === 'testimonials'
                  ? 'bg-ds-accent text-white shadow-glow-sm'
                  : 'text-ds-text-muted hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Reviews</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors ${
                activeTab === 'gallery'
                  ? 'bg-ds-accent text-white shadow-glow-sm'
                  : 'text-ds-text-muted hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Gallery</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors ${
                activeTab === 'settings'
                  ? 'bg-ds-accent text-white shadow-glow-sm'
                  : 'text-ds-text-muted hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Venue Config</span>
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={loadCmsData}>
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── TAB 1: Testimonials ──────────────────────────────────────────────── */}
      {activeTab === 'testimonials' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-bold text-base text-ds-text uppercase">
                Customer Testimonials ({testimonials.length})
              </h2>
              <p className="text-xs text-ds-text-muted">
                Approved reviews are displayed on the public landing page.
              </p>
            </div>

            <Button variant="accent" size="sm" onClick={openCreateTestimonial}>
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Add Testimonial</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testimonials.map((t) => (
              <Card
                key={t.id}
                variant="glass"
                className={`p-5 space-y-3 border-l-4 ${
                  t.isApproved ? 'border-l-emerald-400' : 'border-l-amber-400'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-heading font-bold text-sm text-ds-text">
                      {t.customerName}
                    </h3>
                    <div className="flex items-center gap-1 text-amber-400 mt-1">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400" />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Badge variant={t.isApproved ? 'success' : 'warning'} size="sm">
                      {t.isApproved ? 'PUBLISHED' : 'PENDING'}
                    </Badge>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditTestimonial(t)}
                      className="text-xs p-1"
                      title="Edit Review"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-ds-ice" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleTestimonial(t.id, t.isApproved)}
                      className="text-xs p-1"
                      title={t.isApproved ? 'Unpublish' : 'Approve'}
                    >
                      {t.isApproved ? (
                        <XCircle className="w-4 h-4 text-amber-400" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTestimonial(t.id)}
                      className="text-xs p-1 text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-ds-text-dim italic leading-relaxed">
                  &ldquo;{t.content}&rdquo;
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 2: Gallery ──────────────────────────────────────────────────── */}
      {activeTab === 'gallery' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-bold text-base text-ds-text uppercase">
                Arena Visual Gallery ({gallery.length})
              </h2>
              <p className="text-xs text-ds-text-muted">
                Photos showcased across the public website and facilities tour.
              </p>
            </div>

            <Button variant="accent" size="sm" onClick={openCreateGallery}>
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Add Arena Photo</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {gallery.map((g) => (
              <Card key={g.id} variant="glass" className="overflow-hidden group relative p-0">
                <div className="aspect-video w-full relative bg-ds-surface overflow-hidden">
                  <img
                    src={g.url}
                    alt={g.altText || 'Arena Image'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2.5 left-2.5">
                    <Badge variant="accent" size="sm">
                      {g.category}
                    </Badge>
                  </div>
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditGallery(g)}
                      className="p-1.5 rounded-lg bg-black/60 text-ds-ice hover:text-white backdrop-blur-md transition-colors"
                      title="Edit Photo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGallery(g.id)}
                      className="p-1.5 rounded-lg bg-black/60 text-rose-400 hover:text-rose-300 backdrop-blur-md transition-colors"
                      title="Delete Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-3 text-xs text-ds-text-dim">
                  <p className="font-heading font-semibold text-ds-text truncate">
                    {g.altText || 'Venue Showcase'}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 3: Venue Config ────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-bold text-base text-ds-text uppercase">
                Operational Settings & Venue Announcements
              </h2>
              <p className="text-xs text-ds-text-muted">
                Changes take effect across the public website immediately.
              </p>
            </div>

            <Button
              variant="accent"
              size="sm"
              onClick={handleSaveSettings}
              isLoading={savingSettings}
            >
              <Save className="w-4 h-4 mr-1.5" />
              <span>Save & Publish</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Announcement Banner */}
            <Card variant="glass" className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-ds-accent" />
                <h3 className="font-heading font-bold text-sm text-ds-text uppercase">
                  Top Announcement Banner
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-ds-text-dim block mb-1">Banner Status</label>
                  <select
                    value={settings.announcement_enabled || 'true'}
                    onChange={(e) =>
                      setSettings({ ...settings, announcement_enabled: e.target.value })
                    }
                    className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-ds-text font-mono"
                  >
                    <option value="true">Active & Visible to Public</option>
                    <option value="false">Disabled / Hidden</option>
                  </select>
                </div>

                <div>
                  <label className="text-ds-text-dim block mb-1">Announcement Message</label>
                  <textarea
                    rows={2}
                    value={settings.announcement_text || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, announcement_text: e.target.value })
                    }
                    className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-ds-text font-mono resize-none"
                    placeholder="Enter special promotion or tournament alert..."
                  />
                </div>

                <div>
                  <label className="text-ds-text-dim block mb-1">Target Click URL</label>
                  <Input
                    value={settings.announcement_link || '/booking'}
                    onChange={(e) =>
                      setSettings({ ...settings, announcement_link: e.target.value })
                    }
                    placeholder="/booking or /pricing"
                  />
                </div>
              </div>
            </Card>

            {/* Arena Operating Hours */}
            <Card variant="glass" className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-ds-ice" />
                <h3 className="font-heading font-bold text-sm text-ds-text uppercase">
                  Operating Hours
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-ds-text-dim block mb-1">Weekday Timings (Mon - Thu)</label>
                  <Input
                    value={settings.operating_hours_weekdays || '10:00 AM - 11:30 PM'}
                    onChange={(e) =>
                      setSettings({ ...settings, operating_hours_weekdays: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-ds-text-dim block mb-1">Weekend Timings (Fri - Sun)</label>
                  <Input
                    value={settings.operating_hours_weekends || '09:30 AM - 01:00 AM'}
                    onChange={(e) =>
                      setSettings({ ...settings, operating_hours_weekends: e.target.value })
                    }
                  />
                </div>
              </div>
            </Card>

            {/* Venue Contact Details */}
            <Card variant="glass" className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <h3 className="font-heading font-bold text-sm text-ds-text uppercase">
                  Venue Contact & Coordinates
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-ds-text-dim block mb-1">Front-Desk WhatsApp</label>
                  <Input
                    value={settings.contact_whatsapp || '+91 98765 43210'}
                    onChange={(e) =>
                      setSettings({ ...settings, contact_whatsapp: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-ds-text-dim block mb-1">Support Email</label>
                  <Input
                    value={settings.contact_email || 'support@darksyndicate.in'}
                    onChange={(e) =>
                      setSettings({ ...settings, contact_email: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-ds-text-dim block mb-1">Physical Venue Address</label>
                  <textarea
                    rows={2}
                    value={settings.venue_address || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, venue_address: e.target.value })
                    }
                    className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-ds-text font-mono resize-none"
                  />
                </div>
              </div>
            </Card>

            {/* Social Communities */}
            <Card variant="glass" className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400" />
                <h3 className="font-heading font-bold text-sm text-ds-text uppercase">
                  Social Channels
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-ds-text-dim block mb-1">Instagram Profile</label>
                  <Input
                    value={settings.social_instagram || 'https://instagram.com/darksyndicate.gaming'}
                    onChange={(e) =>
                      setSettings({ ...settings, social_instagram: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-ds-text-dim block mb-1">Discord Community</label>
                  <Input
                    value={settings.social_discord || 'https://discord.gg/darksyndicate'}
                    onChange={(e) =>
                      setSettings({ ...settings, social_discord: e.target.value })
                    }
                  />
                </div>
              </div>
            </Card>

            {/* Front-Desk Counter UPI & QR Standee Setup */}
            <Card variant="glass" className="p-6 space-y-4 md:col-span-2 border-ds-accent/30 bg-ds-surface/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-ds-accent" />
                  <h3 className="font-heading font-bold text-sm text-ds-text uppercase">
                    Front-Desk Counter UPI & QR Standee
                  </h3>
                </div>
                <Badge variant="accent" size="sm" className="font-mono text-[10px]">
                  Staff Walk-in & Extension
                </Badge>
              </div>
              <p className="text-xs text-ds-text-dim">
                Upload your arena&apos;s official UPI QR code standee image or set your VPA ID. When staff selects &quot;UPI / QR&quot; during walk-ins or session extensions, this QR code will be shown directly on screen for customers to scan and pay.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs pt-1">
                <div className="space-y-3">
                  <div>
                    <label className="text-ds-text-dim block mb-1">Counter UPI ID (VPA)</label>
                    <Input
                      placeholder="e.g. darksyndicate@icici"
                      value={settings.counter_upi_id || ''}
                      onChange={(e) => setSettings({ ...settings, counter_upi_id: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-ds-text-dim block mb-1">Payee Business / Account Name</label>
                    <Input
                      placeholder="e.g. Dark Syndicate Gaming World"
                      value={settings.counter_upi_name || ''}
                      onChange={(e) => setSettings({ ...settings, counter_upi_name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-ds-text-dim block mb-1">QR Code Image URL (Optional)</label>
                    <Input
                      placeholder="https://.../upi-qr.png or upload below"
                      value={settings.counter_upi_qr_url || ''}
                      onChange={(e) => setSettings({ ...settings, counter_upi_qr_url: e.target.value })}
                    />
                  </div>
                </div>

                {/* QR Upload & Live Preview Box */}
                <div className="space-y-2">
                  <label className="text-ds-text-dim block">Upload Official Standee QR Image</label>
                  <div className="border border-dashed border-ds-border rounded-xl p-4 bg-ds-dark/60 text-center flex flex-col items-center justify-center min-h-[170px]">
                    {settings.counter_upi_qr_url ? (
                      <div className="space-y-2 flex flex-col items-center">
                        <div className="w-36 h-36 bg-white p-2 rounded-xl shadow-lg border border-ds-border flex items-center justify-center overflow-hidden">
                          <img
                            src={settings.counter_upi_qr_url}
                            alt="Counter UPI QR Code"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, counter_upi_qr_url: '' })}
                          className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                        >
                          Remove / Replace QR
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center gap-2 p-2">
                        <div className="w-10 h-10 rounded-xl bg-ds-surface flex items-center justify-center border border-ds-accent/40 text-ds-accent">
                          <QrCode className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-heading font-bold text-ds-text">Click to Upload Standee QR</span>
                        <span className="text-[10px] text-ds-text-dim">Supports PNG, JPG, WEBP (Max 5MB)</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 5 * 1024 * 1024) {
                                toast.error('QR image file must be under 5MB');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const result = event.target?.result as string;
                                setSettings({ ...settings, counter_upi_qr_url: result });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Testimonial */}
      <Modal
        isOpen={testiModalOpen}
        onClose={() => {
          setTestiModalOpen(false);
          setEditingTesti(null);
        }}
        title={editingTesti ? 'Edit Customer Review' : 'Add Customer Review'}
      >
        <form onSubmit={handleCreateTestimonial} className="space-y-4 text-xs">
          <div>
            <label className="text-ds-text-dim block mb-1">Customer / Gamer Name</label>
            <Input
              required
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="e.g. Varun K."
            />
          </div>

          <div>
            <label className="text-ds-text-dim block mb-1">Rating</label>
            <select
              value={newRating}
              onChange={(e) => setNewRating(e.target.value)}
              className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-ds-text font-mono"
            >
              <option value="5">★★★★★ (5 Stars - Outstanding)</option>
              <option value="4">★★★★☆ (4 Stars - Great)</option>
              <option value="3">★★★☆☆ (3 Stars - Average)</option>
            </select>
          </div>

          <div>
            <label className="text-ds-text-dim block mb-1">Review Content</label>
            <textarea
              required
              rows={3}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Enter what the player had to say about the arena..."
              className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-ds-text font-mono resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                setTestiModalOpen(false);
                setEditingTesti(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="accent" size="sm" type="submit">
              {editingTesti ? 'Save Changes' : 'Publish Review'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add / Edit Gallery Photo */}
      <Modal
        isOpen={galleryModalOpen}
        onClose={() => {
          setGalleryModalOpen(false);
          setEditingGallery(null);
        }}
        title={editingGallery ? 'Edit Venue Gallery Photo' : 'Add Photo to Venue Gallery'}
      >
        <form onSubmit={handleCreateGallery} className="space-y-4 text-xs">
          <div>
            <label className="text-ds-text-dim block mb-1">Image URL / Path</label>
            <Input
              required
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
            />
          </div>

          <div>
            <label className="text-ds-text-dim block mb-1">Category</label>
            <select
              value={newImageCategory}
              onChange={(e) => setNewImageCategory(e.target.value)}
              className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-ds-text font-mono"
            >
              <option value="gaming">Gaming & Battle Stations</option>
              <option value="venue">Venue & Lounge Ambience</option>
              <option value="rigs">Sim Rigs & Hardware</option>
              <option value="events">Tournaments & Community</option>
            </select>
          </div>

          <div>
            <label className="text-ds-text-dim block mb-1">Caption / Alt Text</label>
            <Input
              value={newImageAlt}
              onChange={(e) => setNewImageAlt(e.target.value)}
              placeholder="e.g. VIP PS5 Arena with Curved OLEDs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                setGalleryModalOpen(false);
                setEditingGallery(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="accent" size="sm" type="submit">
              {editingGallery ? 'Save Changes' : 'Save Photo'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
