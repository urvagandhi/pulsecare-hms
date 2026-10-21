import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AppointmentCard, AppointmentRecord } from '@/components/Shared/AppointmentCard';
import { TablePageSkeleton } from '@/components/Shared/DashboardSkeleton';
import { formatDateForInput } from '@/lib/format';

interface AppointmentsResponse {
  success: boolean;
  data: AppointmentRecord[];
}

export function DoctorSchedule() {
  const user = useAppSelector((s) => s.auth.user);
  const queryClient = useQueryClient();

  const todayStr = useMemo(() => formatDateForInput(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateForInput(d);
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const { data, isLoading, refetch } = useQuery<AppointmentsResponse>({
    queryKey: ['appointments', 'doctor', selectedDate, user?._id],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDate === 'all' || selectedDate === 'upcoming') {
        params.set('date', 'upcoming');
      } else if (selectedDate === 'past') {
        params.set('date', 'past');
      } else if (selectedDate) {
        params.set('date', selectedDate);
      }
      const res = await api.get(`/appointments?${params}`);
      return res.data;
    },
    enabled: !!user?._id,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/appointments/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['doctor-dashboard'] });
    },
  });

  const rawAppointments = data?.data ?? [];
  const appointments = useMemo(() => {
    if (selectedDate === 'past') {
      return rawAppointments;
    }
    // Active schedule tabs (Today, Tomorrow, All Upcoming, or date picker) show active visits only.
    // Cancelled and noShow appointments immediately move to 'Past History'.
    return rawAppointments.filter((a) => a.status !== 'cancelled' && a.status !== 'noShow');
  }, [rawAppointments, selectedDate]);

  if (isLoading && !data) {
    return <TablePageSkeleton title="Loading Doctor Schedule..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Schedule</h1>
          <p className="text-muted-foreground">View and manage your appointments</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="text-xs h-9 gap-1.5 self-start sm:self-auto rounded-xl"
        >
          ↻ Refresh Schedule
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Appointments</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={selectedDate === todayStr ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDate(todayStr)}
              >
                Today
              </Button>
              <Button
                type="button"
                variant={selectedDate === tomorrowStr ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDate(tomorrowStr)}
              >
                Tomorrow
              </Button>
              <Button
                type="button"
                variant={selectedDate === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDate('all')}
              >
                All Upcoming
              </Button>
              <Button
                type="button"
                variant={selectedDate === 'past' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDate('past')}
              >
                Past History
              </Button>
              <Input
                type="date"
                value={selectedDate === 'all' || selectedDate === 'past' ? '' : selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || 'all')}
                className="w-full sm:w-44"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading appointments...</p>
          )}
          {!isLoading && appointments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {selectedDate === 'past'
                  ? 'No past appointment history found.'
                  : selectedDate === 'all'
                  ? 'No upcoming appointments found.'
                  : `No appointments scheduled for ${selectedDate}.`}
              </p>
              {selectedDate !== 'all' && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setSelectedDate('all')}
                  className="mt-1 text-primary text-xs"
                >
                  View all upcoming appointments →
                </Button>
              )}
            </div>
          )}
          <div className="space-y-3">
            {appointments.map((appt) => (
              <AppointmentCard
                key={appt._id}
                appointment={appt}
                viewAs="doctor"
                onConfirm={(id) => updateStatus.mutate({ id, status: 'confirmed' })}
                onStart={(id) => updateStatus.mutate({ id, status: 'inProgress' })}
                onComplete={(id) => updateStatus.mutate({ id, status: 'completed' })}
                onCancel={(id) => updateStatus.mutate({ id, status: 'cancelled' })}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
