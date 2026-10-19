'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Gamepad2,
  Plus,
  Edit2,
  Trash2,
  RotateCw,
  Search,
  Users,
  CheckCircle2,
  Sparkles,
  Layers,
  Monitor,
  Flame,
  Check,
  X,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface Station {
  id: string;
  name: string;
  stationType: string;
  facilityId: string;
}

interface Game {
  id: string;
  title: string;
  slug: string;
  platform: 'PS5' | 'POOL_TABLE' | 'PC' | 'VR' | 'OTHER';
  genre: string | null;
  description: string | null;
  coverImage: string | null;
  maxPlayers: number;
  stationIds: string[] | null;
  isFeatured: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

const PRESET_COVERS = [
  { name: 'EA Sports FC 24', url: '/games/ea-sports-fc-24.jpg' },
  { name: 'Tekken 8', url: '/games/tekken-8.jpg' },
  { name: "Spider-Man 2", url: '/games/spiderman-2.jpg' },
  { name: 'Gran Turismo 7', url: '/games/gran-turismo-7.jpg' },
  { name: 'Mortal Kombat 1', url: '/games/mortal-kombat-1.jpg' },
  { name: 'God of War Ragnarök', url: '/games/god-of-war-ragnarok.jpg' },
  { name: 'Snooker Table', url: '/snooker-table.jpg' },
  { name: 'PS5 Station', url: '/ps5-station.jpg' },
];

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [stationFilter, setStationFilter] = useState<string>('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formPlatform, setFormPlatform] = useState<'PS5' | 'POOL_TABLE' | 'PC' | 'VR' | 'OTHER'>('PS5');
  const [formGenre, setFormGenre] = useState('Sports');
  const [formDescription, setFormDescription] = useState('');
  const [formCoverImage, setFormCoverImage] = useState('');
  const [formMaxPlayers, setFormMaxPlayers] = useState(2);
  const [formStationIds, setFormStationIds] = useState<string[]>([]);
  const [formAllStations, setFormAllStations] = useState(true);
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  const toast = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/games');
      const json = await res.json();
      if (json.success && json.data) {
        setGames(json.data.games || []);
        setStations(json.data.stations || []);
      }
    } catch {
      toast.error('Failed to load games catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingGame(null);
    setFormTitle('');
    setFormPlatform('PS5');
    setFormGenre('Fighting');
    setFormDescription('');
    setFormCoverImage(PRESET_COVERS[0].url);
    setFormMaxPlayers(2);
    setFormStationIds([]);
    setFormAllStations(true);
    setFormIsFeatured(false);
    setFormIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (game: Game) => {
    setEditingGame(game);
    setFormTitle(game.title);
    setFormPlatform(game.platform);
    setFormGenre(game.genre || 'Sports');
    setFormDescription(game.description || '');
    setFormCoverImage(game.coverImage || PRESET_COVERS[0].url);
    setFormMaxPlayers(game.maxPlayers);
    const assignedIds = Array.isArray(game.stationIds) ? game.stationIds : [];
    setFormStationIds(assignedIds);
    setFormAllStations(assignedIds.length === 0);
    setFormIsFeatured(game.isFeatured);
    setFormIsActive(game.isActive);
    setModalOpen(true);
  };

  const handleStationCheckbox = (stationId: string, checked: boolean) => {
    if (checked) {
      setFormStationIds((prev) => [...prev, stationId]);
      setFormAllStations(false);
    } else {
      const next = formStationIds.filter((id) => id !== stationId);
      setFormStationIds(next);
      if (next.length === 0) {
        setFormAllStations(true);
      }
    }
  };

  const handleAllStationsToggle = (checked: boolean) => {
    setFormAllStations(checked);
    if (checked) {
      setFormStationIds([]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || formTitle.trim().length < 2) {
      toast.error('Game title must be at least 2 characters');
      return;
    }

    const maxPlayers = Number(formMaxPlayers);
    if (isNaN(maxPlayers) || maxPlayers < 1 || maxPlayers > 16) {
      toast.error('Max players must be between 1 and 16');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: formTitle.trim(),
        platform: formPlatform,
        genre: formGenre.trim(),
        description: formDescription.trim(),
        coverImage: formCoverImage.trim(),
        maxPlayers: Number(formMaxPlayers),
        stationIds: formAllStations ? [] : formStationIds,
        isFeatured: formIsFeatured,
        isActive: formIsActive,
      };

      const url = editingGame ? `/api/admin/games/${editingGame.id}` : '/api/admin/games';
      const method = editingGame ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.data.message || (editingGame ? 'Game updated' : 'Game added to library'));
        setModalOpen(false);
        loadData();
      } else {
        toast.error(json.error?.message || 'Failed to save game');
      }
    } catch {
      toast.error('Network error saving game');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (game: Game) => {
    if (!confirm(`Are you sure you want to remove "${game.title}" from the Arena catalog?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/games/${game.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(`"${game.title}" removed`);
        loadData();
      } else {
        toast.error(json.error?.message || 'Failed to delete game');
      }
    } catch {
      toast.error('Network error deleting game');
    }
  };

  // Filtered games
  const filteredGames = games.filter((game) => {
    const matchesSearch =
      !search ||
      game.title.toLowerCase().includes(search.toLowerCase()) ||
      (game.genre && game.genre.toLowerCase().includes(search.toLowerCase()));

    const matchesPlatform = platformFilter === 'ALL' || game.platform === platformFilter;

    let matchesStation = true;
    if (stationFilter !== 'ALL') {
      const targetStation = stations.find((s) => s.id === stationFilter);
      if (targetStation) {
        if (game.platform !== targetStation.stationType) {
          matchesStation = false;
        } else if (game.stationIds && game.stationIds.length > 0) {
          matchesStation = game.stationIds.includes(stationFilter);
        }
      }
    }

    return matchesSearch && matchesPlatform && matchesStation;
  });

  const ps5Count = games.filter((g) => g.platform === 'PS5').length;
  const poolCount = games.filter((g) => g.platform === 'POOL_TABLE').length;
  const multiCount = games.filter((g) => g.maxPlayers > 1).length;
  const ps5StationCount = stations.filter((s) => s.stationType === 'PS5').length;
  const poolStationCount = stations.filter((s) => s.stationType === 'POOL_TABLE').length;
  const platformStations = stations.filter((s) => s.stationType === formPlatform);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-ds-accent animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-ds-accent font-bold">
              CONSOLE & ARENA CATALOG
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase text-ds-text">
            Arena Games Library
          </h1>
          <p className="text-xs text-ds-text-muted mt-1">
            Configure titles, box arts, and specific station installations visible to users and staff.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button variant="accent" size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add New Game</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="glass" className="p-4 border-ds-accent/30">
          <div className="flex items-center justify-between text-xs text-ds-text-dim">
            <span>TOTAL TITLES</span>
            <Gamepad2 className="w-4 h-4 text-ds-ice" />
          </div>
          <p className="text-2xl sm:text-3xl font-heading font-black text-ds-text mt-2">{games.length}</p>
          <p className="text-[10px] text-emerald-400 mt-1">Ready for players</p>
        </Card>

        <Card variant="glass" className="p-4 border-ds-border">
          <div className="flex items-center justify-between text-xs text-ds-text-dim">
            <span>PLAYSTATION 5</span>
            <Monitor className="w-4 h-4 text-ds-accent" />
          </div>
          <p className="text-2xl sm:text-3xl font-heading font-black text-ds-text mt-2">{ps5Count}</p>
          <p className="text-[10px] text-ds-text-muted mt-1">
            Across {ps5StationCount} PS5 Battle Station{ps5StationCount === 1 ? '' : 's'}
          </p>
        </Card>

        <Card variant="glass" className="p-4 border-amber-500/30">
          <div className="flex items-center justify-between text-xs text-ds-text-dim">
            <span>SNOOKER & BILLIARDS</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-heading font-black text-amber-300 mt-2">{poolCount}</p>
          <p className="text-[10px] text-amber-400/80 mt-1">
            Across {poolStationCount} Championship Table{poolStationCount === 1 ? '' : 's'}
          </p>
        </Card>

        <Card variant="glass" className="p-4 border-emerald-500/30">
          <div className="flex items-center justify-between text-xs text-ds-text-dim">
            <span>MULTIPLAYER (2-4P)</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-heading font-black text-emerald-300 mt-2">{multiCount}</p>
          <p className="text-[10px] text-emerald-400/80 mt-1">Local & Couch Co-op</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card variant="glass" className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ds-text-dim" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by game title, genre (Tekken, Football, Racing)..."
              className="pl-10 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-ds-surface border border-ds-border rounded-xl px-3 py-2 text-xs font-heading font-bold text-ds-text focus:outline-none focus:border-ds-accent"
            >
              <option value="ALL">All Platforms</option>
              <option value="PS5">PlayStation 5</option>
              <option value="POOL_TABLE">Snooker / Billiards</option>
              <option value="PC">PC Gaming</option>
              <option value="VR">Virtual Reality</option>
            </select>

            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="bg-ds-surface border border-ds-border rounded-xl px-3 py-2 text-xs font-heading font-bold text-ds-text focus:outline-none focus:border-ds-accent"
            >
              <option value="ALL">All Stations</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.stationType})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Games Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-ds-text-dim flex flex-col items-center gap-3">
          <RotateCw className="w-6 h-6 animate-spin text-ds-accent" />
          <span>Loading Arena Games Catalog...</span>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="p-16 text-center text-xs text-ds-text-dim border border-dashed border-ds-border rounded-2xl">
          <Gamepad2 className="w-10 h-10 text-ds-accent/40 mx-auto mb-3" />
          <p className="font-heading font-bold text-sm text-ds-text">No games found matching your filters</p>
          <p className="mt-1">Try adjusting your search query or add a new game title.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredGames.map((game) => {
            const isPs5 = game.platform === 'PS5';
            const assignedStationNames =
              game.stationIds && game.stationIds.length > 0
                ? stations
                    .filter((s) => game.stationIds!.includes(s.id))
                    .map((s) => s.name)
                : [`All ${isPs5 ? 'PS5' : game.platform} Consoles`];

            return (
              <Card
                key={game.id}
                variant="default"
                className="overflow-hidden border-ds-border hover:border-ds-accent/60 transition-all flex flex-col justify-between group bg-ds-dark/70"
              >
                <div>
                  {/* Poster / Box Art Header */}
                  <div className="h-44 w-full relative bg-ds-surface overflow-hidden">
                    {game.coverImage ? (
                      <img
                        src={game.coverImage}
                        alt={game.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          // Fallback to placeholder if image fails
                          (e.target as HTMLImageElement).src = PRESET_COVERS[0].url;
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-ds-surface/60 text-ds-text-dim">
                        <Gamepad2 className="w-12 h-12 opacity-30" />
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-ds-dark via-transparent to-black/40" />

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <Badge
                        variant={isPs5 ? 'accent' : 'warning'}
                        size="sm"
                        className="font-mono uppercase font-bold text-[10px]"
                      >
                        {game.platform}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {game.isFeatured && (
                          <span className="p-1 rounded bg-amber-500/80 text-black font-bold text-[9px] uppercase tracking-wider flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5 fill-black" />
                            HOT
                          </span>
                        )}
                        {!game.isActive && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[9px] font-mono">
                            INACTIVE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Title on Image */}
                    <div className="absolute bottom-2 left-3 right-3">
                      <span className="text-[10px] font-mono uppercase text-ds-accent font-bold">
                        {game.genre || 'General'}
                      </span>
                      <h3 className="font-heading font-black text-sm text-white line-clamp-1">
                        {game.title}
                      </h3>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-ds-text-muted line-clamp-2 min-h-[32px]">
                      {game.description || 'Installed and ready to play on arena consoles.'}
                    </p>

                    {/* Players & Features */}
                    <div className="flex items-center justify-between text-[11px] text-ds-text-dim pt-2 border-t border-ds-border/50">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-ds-accent" />
                        <span className="font-heading font-bold text-ds-text">
                          {game.maxPlayers === 1 ? '1 Player' : `Up to ${game.maxPlayers} Players`}
                        </span>
                      </span>
                    </div>

                    {/* Installed On Stations */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase text-ds-text-dim font-bold block">
                        Installed On:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {assignedStationNames.slice(0, 3).map((stName, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-ds-surface border border-ds-border text-[10px] font-mono text-ds-ice"
                          >
                            {stName}
                          </span>
                        ))}
                        {assignedStationNames.length > 3 && (
                          <span className="px-1.5 py-0.5 text-[9px] font-mono text-ds-text-dim">
                            +{assignedStationNames.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 border-t border-ds-border/60 flex items-center justify-end gap-1.5 bg-ds-surface/30">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(game)}
                    className="h-7 px-2.5 text-[11px] font-heading font-bold hover:border-ds-accent hover:text-ds-accent flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3 text-ds-accent" />
                    <span>Edit</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(game)}
                    className="h-7 px-2 text-[11px] text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                    title="Delete game"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Game Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingGame ? `Edit Game: ${editingGame.title}` : 'Add New Game to Arena'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Game Title *
              </label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Tekken 8, EA FC 24"
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Platform / Arena Zone
              </label>
              <select
                value={formPlatform}
                onChange={(e) => {
                  const nextPlatform = e.target.value as any;
                  setFormPlatform(nextPlatform);
                  setFormStationIds([]);
                  setFormAllStations(true);
                }}
                className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2.5 text-xs text-ds-text focus:outline-none focus:border-ds-accent"
              >
                <option value="PS5">PlayStation 5</option>
                <option value="POOL_TABLE">Snooker / Billiards Table</option>
                <option value="PC">PC Gaming Rig</option>
                <option value="VR">Virtual Reality</option>
                <option value="OTHER">Other Platform</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Genre
              </label>
              <select
                value={formGenre}
                onChange={(e) => setFormGenre(e.target.value)}
                className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2.5 text-xs text-ds-text focus:outline-none focus:border-ds-accent"
              >
                <option value="Fighting">Fighting</option>
                <option value="Sports">Sports</option>
                <option value="Action-Adventure">Action-Adventure</option>
                <option value="Racing">Racing</option>
                <option value="Co-op Adventure">Co-op Adventure</option>
                <option value="Shooter">Shooter</option>
                <option value="Billiards">Billiards / Pool</option>
                <option value="Party">Party / Casual</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Max Players Capacity
              </label>
              <select
                value={formMaxPlayers}
                onChange={(e) => setFormMaxPlayers(Number(e.target.value))}
                className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2.5 text-xs text-ds-text focus:outline-none focus:border-ds-accent font-mono"
              >
                <option value={1}>1 Player (Single)</option>
                <option value={2}>2 Players (Versus / Co-op)</option>
                <option value={4}>4 Players (Squad / Party)</option>
                <option value={6}>6 Players (Group)</option>
                <option value={8}>8 Players (Tournament)</option>
                <option value={12}>12 Players (Lobby)</option>
                <option value={16}>16 Players (Max Arena)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
              Box Art / Poster Image URL
            </label>
            <Input
              value={formCoverImage}
              onChange={(e) => setFormCoverImage(e.target.value)}
              placeholder="https://images.unsplash.com/... or game poster image URL"
              className="text-xs font-mono"
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-ds-text-dim">Quick Presets:</span>
              {PRESET_COVERS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setFormCoverImage(preset.url)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-ds-surface hover:bg-ds-accent/20 text-ds-text-dim hover:text-ds-accent transition-colors"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
              Description / Setup Notes
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={2}
              placeholder="e.g. 4K 120Hz, 2 DualSense controllers, Heat system enabled"
              className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-xs text-ds-text focus:outline-none focus:border-ds-accent resize-none"
            />
          </div>

          {/* Station Assignment */}
          <div className="p-3.5 rounded-xl bg-ds-dark/60 border border-ds-border space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-accent">
                Station Installation / Availability
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formAllStations}
                  onChange={(e) => handleAllStationsToggle(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-ds-border bg-ds-dark text-ds-accent focus:ring-0 cursor-pointer"
                />
                <span className="text-[11px] font-heading font-bold text-ds-text">
                  Installed on ALL {formPlatform} Stations
                </span>
              </label>
            </div>

            {!formAllStations && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] text-ds-text-dim">
                  Select specific consoles where this game is installed:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {platformStations.map((st) => {
                    const isChecked = formStationIds.includes(st.id);
                    return (
                      <label
                        key={st.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-ds-accent/10 border-ds-accent text-ds-ice font-bold'
                            : 'bg-ds-surface/40 border-ds-border/60 text-ds-text-dim hover:text-ds-text'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleStationCheckbox(st.id, e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-ds-border bg-ds-dark text-ds-accent focus:ring-0"
                        />
                        <span className="truncate">{st.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-ds-border/60">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsFeatured}
                  onChange={(e) => setFormIsFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-ds-border bg-ds-dark text-amber-400 focus:ring-0"
                />
                <span className="text-xs text-ds-text font-heading font-semibold">Featured Title</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-ds-border bg-ds-dark text-ds-accent focus:ring-0"
                />
                <span className="text-xs text-ds-text font-heading font-semibold">Active & Playable</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" size="sm" isLoading={submitting}>
                <Check className="w-3.5 h-3.5 mr-1" />
                <span>{editingGame ? 'Save Changes' : 'Add to Catalog'}</span>
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
