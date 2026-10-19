'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  MessageCircle,
  Send,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  inquiryType: 'GENERAL' | 'BOOKING' | 'TOURNAMENT' | 'PARTY' | 'FEEDBACK';
  message: string;
}

export default function ContactPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    mode: 'onTouched',
    defaultValues: {
      inquiryType: 'GENERAL',
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to submit inquiry');
      }

      setSubmittedTicket(json.data.ticketId);
      toast('Message sent successfully! Our team will respond shortly.', 'success');
      reset();
    } catch (err: any) {
      toast(err.message || 'Error submitting message. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ds-dark text-ds-text selection:bg-ds-accent selection:text-ds-dark flex flex-col">
      <Navbar />

      <main className="flex-1 pt-32 sm:pt-36 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ds-surface border border-ds-accent/30 text-xs font-heading font-bold uppercase tracking-[0.2em] text-ds-ice">
              <Mail className="w-3.5 h-3.5 text-ds-accent" />
              Direct Communication
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-extrabold tracking-tight uppercase">
              LOCATION & <span className="gradient-text">CONTACT</span>
            </h1>
            <p className="text-ds-text-muted text-base sm:text-lg">
              Have questions about tournaments, party reservations, or station availability? Reach out directly or drop by the arena.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Column: Venue Info & Operating Hours */}
            <div className="lg:col-span-5 space-y-6">
              {/* Arena Info Card */}
              <Card glass className="p-8 border-ds-accent/30 space-y-6">
                <h3 className="font-heading font-bold text-xl text-ds-text uppercase">
                  Arena Headquarters
                </h3>

                <ul className="space-y-4 text-sm">
                  <li className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-ds-primary/20 border border-ds-primary/40 flex items-center justify-center shrink-0 mt-0.5 text-ds-accent">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-ds-text">Physical Address</p>
                      <p className="text-xs text-ds-text-muted mt-0.5 leading-relaxed">
                        DARK SYNDICATE GAMING WORLD
                        <br />
                        Plot 42, 1st Cross Street, Main Commercial Hub
                        <br />
                        Anna Nagar, Chennai, Tamil Nadu 600040
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 text-emerald-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-ds-text">Phone & WhatsApp</p>
                      <a href="tel:+919876543210" className="text-xs text-ds-ice hover:underline block mt-0.5">
                        +91 98765 43210 (Desk Direct)
                      </a>
                      <a
                        href="https://wa.me/919876543210"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-400 hover:underline block mt-0.5"
                      >
                        Chat on WhatsApp (Instant Reply)
                      </a>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-ds-surface border border-ds-border flex items-center justify-center shrink-0 mt-0.5 text-ds-accent">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-ds-text">Email Inquiries</p>
                      <a href="mailto:support@darksyndicate.com" className="text-xs text-ds-ice hover:underline block mt-0.5">
                        support@darksyndicate.com
                      </a>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-ds-surface border border-ds-border flex items-center justify-center shrink-0 mt-0.5 text-amber-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-ds-text">Operating Timetable</p>
                      <p className="text-xs text-ds-text-muted mt-0.5">
                        Monday – Sunday: 10:00 AM – 12:00 AM Midnight
                      </p>
                      <p className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                        Open all 365 days including public holidays
                      </p>
                    </div>
                  </li>
                </ul>

                <div className="pt-4 border-t border-ds-border">
                  <a href="https://wa.me/919876543210" target="_blank" rel="noreferrer" className="block w-full">
                    <Button variant="accent" className="w-full justify-center">
                      <MessageCircle className="w-4 h-4 mr-2 text-emerald-300" />
                      Instant WhatsApp Support
                    </Button>
                  </a>
                </div>
              </Card>

              {/* Map Preview Mock */}
              <div className="rounded-2xl bg-ds-surface/60 border border-ds-border p-5 text-center space-y-2">
                <MapPin className="w-6 h-6 text-ds-accent mx-auto" />
                <h4 className="font-heading font-bold text-sm text-ds-text uppercase">
                  Finding Us Is Easy
                </h4>
                <p className="text-xs text-ds-text-muted">
                  Located right opposite Central Mall with designated two-wheeler & car parking available.
                </p>
                <a
                  href="https://maps.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs font-heading font-bold text-ds-ice hover:underline pt-1"
                >
                  Open in Google Maps →
                </a>
              </div>
            </div>

            {/* Right Column: Interactive Contact Form */}
            <div className="lg:col-span-7">
              <Card glass className="p-8 border-ds-border space-y-6">
                <div>
                  <h3 className="font-heading font-bold text-2xl text-ds-text uppercase">
                    SEND US A <span className="gradient-text">MESSAGE</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-ds-text-muted mt-1">
                    Fill out the form below and an arena manager will reach back within 2 business hours.
                  </p>
                </div>

                {submittedTicket && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Inquiry Successfully Dispatched!</p>
                      <p className="mt-0.5">
                        Your reference ticket is <span className="font-mono font-bold text-ds-text">{submittedTicket}</span>. A confirmation notification has been recorded.
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Your Name *"
                      placeholder="e.g. Rahul Sharma"
                      {...register('name', {
                        required: 'Full name is required',
                        minLength: { value: 2, message: 'Name must be at least 2 characters' },
                      })}
                      error={errors.name?.message}
                    />

                    <Input
                      label="Email Address *"
                      type="email"
                      placeholder="e.g. rahul@example.com"
                      {...register('email', {
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address',
                        },
                      })}
                      error={errors.email?.message}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Phone Number"
                      type="tel"
                      placeholder="e.g. 9876543210"
                      {...register('phone', {
                        pattern: {
                          value: /^(\+91[\-\s]?)?[6-9]\d{9}$/,
                          message: 'Please enter a valid 10-digit mobile number',
                        },
                      })}
                      error={errors.phone?.message}
                    />

                    <div>
                      <label className="block text-xs font-heading font-bold uppercase tracking-wider text-ds-text mb-1.5">
                        Inquiry Category
                      </label>
                      <select
                        {...register('inquiryType')}
                        className="w-full h-11 px-3.5 rounded-lg bg-ds-dark/80 border border-ds-border text-sm text-ds-text focus:outline-none focus:border-ds-accent transition-colors cursor-pointer"
                      >
                        <option value="GENERAL">General Inquiry</option>
                        <option value="BOOKING">Booking & Stations</option>
                        <option value="TOURNAMENT">Esports Tournament</option>
                        <option value="PARTY">Birthday / Party Buyout</option>
                        <option value="FEEDBACK">Feedback & Suggestion</option>
                      </select>
                    </div>
                  </div>

                  <Input
                    label="Subject *"
                    placeholder="e.g. Private booking for weekend tournament"
                    {...register('subject', {
                      required: 'Subject is required',
                      minLength: { value: 3, message: 'Subject must be at least 3 characters' },
                    })}
                    error={errors.subject?.message}
                  />

                  <div>
                    <label className="block text-xs font-heading font-bold uppercase tracking-wider text-ds-text mb-1.5">
                      Your Message *
                    </label>
                    <textarea
                      rows={5}
                      placeholder="Tell us about your requirements, group size, or questions..."
                      {...register('message', {
                        required: 'Message is required',
                        minLength: { value: 10, message: 'Message must be at least 10 characters' },
                      })}
                      className={`w-full p-3.5 rounded-lg bg-ds-dark/80 border text-sm text-ds-text placeholder:text-ds-text-dim focus:outline-none focus:border-ds-accent transition-colors ${
                        errors.message ? 'border-rose-500' : 'border-ds-border'
                      }`}
                    />
                    {errors.message && (
                      <p className="text-xs text-rose-400 mt-1">{errors.message.message}</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="accent"
                      size="lg"
                      className="w-full sm:w-auto px-8"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <span>Sending Message...</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="w-4 h-4" /> Send Message
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
