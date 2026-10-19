import Image from 'next/image';
import Link from 'next/link';
import {
  Gamepad2,
  Sparkles,
  Calendar,
  Clock,
  Shield,
  Award,
  ChevronRight,
  Flame,
  Star,
  MapPin,
  Phone,
  MessageCircle,
  Tv,
  Headphones,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/home/HeroSection';
import { LiveStatsBar } from '@/components/home/LiveStatsBar';

export default function HomePage() {
  const flagshipGames = [
    {
      name: 'EA Sports FC 24',
      genre: 'Sports / Soccer',
      players: '1-4 Players',
      tag: 'Top Played',
      image: '/games/ea-sports-fc-24.jpg',
    },
    {
      name: 'Tekken 8',
      genre: 'Fighting / Versus',
      players: '1-2 Players',
      tag: 'Tournament',
      image: '/games/tekken-8.jpg',
    },
    {
      name: 'Marvel’s Spider-Man 2',
      genre: 'Action / Adventure',
      players: '1 Player',
      tag: 'Story Pick',
      image: '/games/spiderman-2.jpg',
    },
    {
      name: 'God of War Ragnarök',
      genre: 'Mythic Action',
      players: '1 Player',
      tag: '4K 120Hz',
      image: '/games/god-of-war-ragnarok.jpg',
    },
    {
      name: 'Mortal Kombat 1',
      genre: 'Versus Fighter',
      players: '1-2 Players',
      tag: 'Competitive',
      image: '/games/mortal-kombat-1.jpg',
    },
    {
      name: 'Gran Turismo 7',
      genre: 'Racing Simulator',
      players: '1 Player',
      tag: 'Wheel Rig',
      image: '/games/gran-turismo-7.jpg',
    },
  ];

  const testimonials = [
    {
      name: 'Aditya Verma',
      tag: 'Competitive Gamer',
      comment:
        'The PS5 Pro setup with 4K 120Hz OLEDs is mindblowing. Zero input lag, insane graphics, and the best venue for FIFA tournaments in town!',
      rating: 5,
    },
    {
      name: 'Siddharth Rao',
      tag: 'Pool Enthusiast',
      comment:
        'The pool tables are genuine tournament grade. Italian slate, Simonis cloth, and the LED canopy lighting makes cueing flawless.',
      rating: 5,
    },
    {
      name: 'Kavya & Group',
      tag: 'Weekend Squad',
      comment:
        'We booked the 4-player lounge for 3 hours. Seamless online booking, instant QR check-in, and great snacks service right at our station.',
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen bg-ds-dark text-ds-text selection:bg-ds-accent selection:text-ds-dark flex flex-col">
      <Navbar />

      <main className="flex-1 pb-20 lg:pb-0">
        {/* ─── Hero Section with Cyber Animations & Scroll Parallax ─ */}
        <HeroSection />

        {/* ─── Live Stats Bar with Intersection Observer & Cyber HUD ── */}
        <LiveStatsBar />

        {/* ─── Featured Gaming Zones ───────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto content-visibility-auto">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-heading font-bold uppercase tracking-[0.25em] text-ds-accent">
              World-Class Facilities
            </span>
            <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-ds-text uppercase">
              CHOOSE YOUR <span className="gradient-text">BATTLEGROUND</span>
            </h2>
            <p className="text-ds-text-muted text-base">
              Engineered for competitive players and relaxed friend hangouts alike. Each station is equipped with benchmark-setting hardware.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Zone 1: PS5 Pro Arena */}
            <Card hover glass className="overflow-hidden p-0 border-ds-accent/30 relative group flex flex-col justify-between">
              <div>
                <div className="relative w-full h-52 sm:h-60 bg-ds-dark overflow-hidden">
                  <Image
                    src="/ps5-station.jpg"
                    alt="PS5 Pro Battle Stations"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ds-surface via-black/25 to-black/60" />
                  <div className="absolute top-4 left-4">
                    <Badge variant="accent" className="backdrop-blur-md shadow-md text-xs font-heading font-bold">
                      PlayStation 5
                    </Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className="text-sm font-heading font-extrabold text-ds-ice bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-sm">
                      From ₹150 / hr
                    </span>
                  </div>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-heading font-bold text-ds-text group-hover:text-ds-ice transition-colors">
                      PS5 Pro Battle Stations
                    </h3>
                    <p className="text-ds-text-muted text-sm mt-2 leading-relaxed">
                      3 PlayStation 5 consoles paired with 55-inch LG OLED TVs at 4K 120FPS. Single player ₹150/hr, duo ₹200/hr, squad (3-4) ₹250/hr.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-ds-text-muted">
                    <div className="flex items-center gap-2">
                      <Tv className="w-4 h-4 text-ds-accent" />
                      <span>55" 4K 120Hz OLEDs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4 text-ds-accent" />
                      <span>DualSense Wireless</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Headphones className="w-4 h-4 text-ds-accent" />
                      <span>SteelSeries 3D Audio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-ds-accent" />
                      <span>1 to 4 Players / Station</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8 pt-0 flex items-center justify-between border-t border-ds-border/40 mt-2">
                <Link href="/pricing">
                  <Button variant="outline" size="sm">
                    View Pricing
                  </Button>
                </Link>
                <Link href="/booking">
                  <Button variant="accent" size="sm">
                    Book PS5 Zone <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Zone 2: Snooker Lounge */}
            <Card hover glass className="overflow-hidden p-0 border-ds-border relative group flex flex-col justify-between">
              <div>
                <div className="relative w-full h-52 sm:h-60 bg-ds-dark overflow-hidden">
                  <Image
                    src="/snooker-table.jpg"
                    alt="Championship Snooker Lounge"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ds-surface via-black/25 to-black/60" />
                  <div className="absolute top-4 left-4">
                    <Badge variant="info" className="backdrop-blur-md shadow-md text-xs font-heading font-bold">
                      Snooker
                    </Badge>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className="text-sm font-heading font-extrabold text-ds-ice bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-sm">
                      ₹250 / hr per table
                    </span>
                  </div>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-heading font-bold text-ds-text group-hover:text-ds-ice transition-colors">
                      Championship Snooker Lounge
                    </h3>
                    <p className="text-ds-text-muted text-sm mt-2 leading-relaxed">
                      3 championship snooker tables. ₹250/hr for 3-4 players per table, +₹50 per extra person beyond 4.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-ds-text-muted">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-ds-ice" />
                      <span>Italian Slate Bed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-ds-ice" />
                      <span>Aramith Pro Balls</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-ds-ice" />
                      <span>Shadowless LED Canopy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-ds-ice" />
                      <span>3-4 Players / Table (+₹50 extra)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8 pt-0 flex items-center justify-between border-t border-ds-border/40 mt-2">
                <Link href="/pricing">
                  <Button variant="outline" size="sm">
                    View Pricing
                  </Button>
                </Link>
                <Link href="/booking">
                  <Button variant="secondary" size="sm">
                    Book Snooker Table <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </section>

        {/* ─── Flagship Games Grid ─────────────────────────────────── */}
        <section className="py-16 bg-ds-surface/30 border-y border-ds-border content-visibility-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
              <div>
                <span className="text-xs font-heading font-bold uppercase tracking-[0.25em] text-ds-accent">
                  Latest Releases
                </span>
                <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-ds-text uppercase mt-1">
                  POPULAR <span className="gradient-text">TITLES IN ROTATION</span>
                </h2>
              </div>
              <p className="text-sm text-ds-text-muted max-w-md">
                Over 250+ PlayStation 5 titles installed and ready to launch instantly with cloud saves enabled.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {flagshipGames.map((game) => (
                <div
                  key={game.name}
                  className="rounded-xl bg-ds-dark/70 border border-ds-border hover:border-ds-accent/40 transition-all group overflow-hidden flex flex-col justify-between shadow-lg hover:shadow-cyan-500/10"
                >
                  <div>
                    {/* Game Cover Image Banner */}
                    <div className="relative w-full h-48 bg-ds-surface/50 overflow-hidden">
                      <Image
                        src={game.image}
                        alt={game.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ds-dark via-ds-dark/30 to-transparent" />
                      <div className="absolute top-3 right-3">
                        <Badge variant="accent" size="sm" className="backdrop-blur-md shadow-md text-[10px] font-heading font-bold">
                          {game.tag}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-5 space-y-1.5">
                      <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-accent">
                        {game.genre}
                      </span>
                      <h4 className="text-lg font-heading font-extrabold text-ds-text group-hover:text-ds-ice transition-colors truncate">
                        {game.name}
                      </h4>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-0">
                    <div className="pt-3 border-t border-ds-border/60 flex items-center justify-between text-xs text-ds-text-dim">
                      <span>{game.players}</span>
                      <span className="text-ds-ice font-medium">Ready on all stations</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── How It Works ────────────────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto content-visibility-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-heading font-bold uppercase tracking-[0.25em] text-ds-accent">
              Frictionless Experience
            </span>
            <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-ds-text uppercase">
              HOW IT <span className="gradient-text">WORKS</span>
            </h2>
            <p className="text-ds-text-muted text-sm sm:text-base">
              Reserve your gaming station in 4 effortless steps with instant digital verification.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Pick Station',
                desc: 'Select PS5 Pro console, Pool Table, or Private VIP Lounge.',
                icon: Gamepad2,
              },
              {
                step: '02',
                title: 'Select Time Slot',
                desc: 'Choose date, start time, and session duration with live availability.',
                icon: Calendar,
              },
              {
                step: '03',
                title: 'Receive QR Pass',
                desc: 'Instant booking reference and digital check-in QR pass sent to your portal.',
                icon: Sparkles,
              },
              {
                step: '04',
                title: 'Walk In & Game',
                desc: 'Scan your QR pass at the entrance counter and jump straight into action.',
                icon: Award,
              },
            ].map((item) => (
              <div
                key={item.step}
                className="p-6 rounded-2xl bg-ds-surface/60 border border-ds-border hover:border-ds-accent/40 relative overflow-hidden group transition-all"
              >
                <div className="text-4xl font-heading font-black text-ds-border/70 group-hover:text-ds-accent/30 transition-colors">
                  {item.step}
                </div>
                <item.icon className="w-8 h-8 text-ds-accent mt-3 mb-4" />
                <h4 className="text-xl font-heading font-bold text-ds-text uppercase">{item.title}</h4>
                <p className="text-ds-text-muted text-xs sm:text-sm mt-2 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Customer Testimonials ──────────────────────────────── */}
        <section className="py-20 bg-ds-surface/40 border-t border-ds-border content-visibility-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
              <span className="text-xs font-heading font-bold uppercase tracking-[0.25em] text-ds-accent">
                Player Reviews
              </span>
              <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-ds-text uppercase">
                TESTED BY THE <span className="gradient-text">COMMUNITY</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((t) => (
                <Card key={t.name} glass className="p-6 space-y-4">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-ds-text-muted text-sm italic leading-relaxed">
                    "{t.comment}"
                  </p>
                  <div className="pt-2 border-t border-ds-border/60">
                    <h5 className="font-heading font-bold text-ds-text text-sm">{t.name}</h5>
                    <span className="text-xs text-ds-accent font-medium">{t.tag}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Location & Hours Callout ────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto content-visibility-auto">
          <div className="rounded-3xl bg-gradient-to-r from-ds-surface via-ds-surface/80 to-ds-dark border border-ds-accent/30 p-8 sm:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-ds-accent/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <Badge variant="accent">Arena Operations</Badge>
                <h3 className="text-3xl sm:text-4xl font-heading font-extrabold text-ds-text uppercase">
                  READY TO ENTER <span className="gradient-text">THE SYNDICATE?</span>
                </h3>
                <p className="text-ds-text-muted text-sm sm:text-base leading-relaxed">
                  Located conveniently in the central gaming district. Walk-ins are always welcome, but advance online reservations guarantee your preferred console and table slot.
                </p>

                <div className="space-y-2 text-sm pt-2">
                  <div className="flex items-center gap-2 text-ds-text">
                    <Clock className="w-4 h-4 text-ds-accent" />
                    <span>Open 7 Days: 10:00 AM – 12:00 AM Midnight</span>
                  </div>
                  <div className="flex items-center gap-2 text-ds-text">
                    <MapPin className="w-4 h-4 text-ds-accent" />
                    <span>Dark Syndicate Arena, Main Commercial Hub</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-4">
                  <Link href="/booking">
                    <Button variant="accent" size="lg">
                      Book Now Online
                    </Button>
                  </Link>
                  <a href="https://wa.me/919876543210" target="_blank" rel="noreferrer">
                    <Button variant="outline" size="lg">
                      <MessageCircle className="w-4 h-4 mr-2 text-emerald-400" />
                      WhatsApp Quick Chat
                    </Button>
                  </a>
                </div>
              </div>

              {/* Quick Hours Summary Card */}
              <div className="p-6 rounded-2xl bg-ds-dark/80 border border-ds-border space-y-4">
                <h4 className="font-heading font-bold text-lg text-ds-ice uppercase">
                  Arena Timetable & Rates
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-ds-border/60">
                    <span className="text-ds-text-muted">Happy Hours (Mon-Thu 11 AM-4 PM)</span>
                    <span className="text-emerald-400 font-bold">15% OFF</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-ds-border/60">
                    <span className="text-ds-text-muted">PS5 Single Player</span>
                    <span className="text-ds-text font-bold">₹150 / hr</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-ds-border/60">
                    <span className="text-ds-text-muted">PS5 Duo (2 Players)</span>
                    <span className="text-ds-text font-bold">₹200 / hr</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-ds-border/60">
                    <span className="text-ds-text-muted">PS5 Squad (3-4 Players)</span>
                    <span className="text-ds-text font-bold">₹250 / hr</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-ds-text-muted">Snooker Table (3-4 Players)</span>
                    <span className="text-ds-ice font-bold">₹250 / hr</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
