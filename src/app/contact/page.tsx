'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  MapPin,
  Send,
  CheckCircle,
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
          <div data-scroll-reveal="" className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ds-surface border border-ds-accent/30 text-xs font-heading font-bold uppercase tracking-[0.2em] text-ds-ice">
              <MapPin className="w-3.5 h-3.5 text-ds-accent" />
              Direct Communication
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-extrabold tracking-tight uppercase">
              LOCATION & <span className="gradient-text">CONTACT</span>
            </h1>
            <p className="text-ds-text-muted text-base sm:text-lg">
              Have questions about tournaments, party reservations, or station availability? Reach out directly or drop by the arena.
            </p>
          </div>

          <div data-scroll-reveal="" className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Column: Venue Info & Operating Hours */}
            <div className="lg:col-span-5 space-y-6">
              <Card glass className="p-5 sm:p-8 border-ds-accent/30 space-y-5">
                <div className="flex items-center gap-3">
                  <MapPin className="w-6 h-6 text-ds-accent" />
                  <h3 className="font-heading font-bold text-xl text-ds-text uppercase">Visit the Arena</h3>
                </div>
                <p className="text-sm text-ds-text-muted">View the venue location and directions on Google Maps.</p>
                <a href="https://maps.app.goo.gl/PFuypQdnfK9Zc5wSA?g_st=iw" target="_blank" rel="noopener noreferrer" className="inline-flex text-sm font-heading font-bold text-ds-ice hover:underline">
                  Open in Google Maps →
                </a>
              </Card>
            </div>

            {/* Right Column: Interactive Contact Form */}
            <div className="lg:col-span-7">
              <Card glass className="p-5 sm:p-8 border-ds-border space-y-6">
                <div>
                  <h3 className="font-heading font-bold text-2xl text-ds-text uppercase">
                    SEND US A <span className="gradient-text">MESSAGE</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-ds-text-muted mt-1">
                    Fill out the form below and our team will review your message.
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
