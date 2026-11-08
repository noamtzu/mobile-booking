import type { AvailabilityInput, Booking, ServiceInput, ServiceUpdate } from '@booking/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const keys = {
  services: ['services'] as const,
  service: (id: string) => ['services', id] as const,
  slots: (serviceId: string) => ['services', serviceId, 'slots'] as const,
  bookings: ['bookings'] as const,
  booking: (id: string) => ['bookings', id] as const,
  adminServices: ['admin', 'services'] as const,
};

export const useServices = () => useQuery({ queryKey: keys.services, queryFn: api.services });

export const useService = (id: string) =>
  useQuery({ queryKey: keys.service(id), queryFn: () => api.service(id), enabled: !!id });

export const useSlots = (serviceId: string) =>
  useQuery({ queryKey: keys.slots(serviceId), queryFn: () => api.slots(serviceId), enabled: !!serviceId });

export const useBookings = () => useQuery({ queryKey: keys.bookings, queryFn: api.bookings });

export const useBooking = (id: string) =>
  useQuery({ queryKey: keys.booking(id), queryFn: () => api.booking(id), enabled: !!id });

export function useBookSlot(serviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId: string) => api.book(slotId),
    onSuccess: (booking) => {
      qc.setQueryData(keys.booking(booking.id), booking);
      void qc.invalidateQueries({ queryKey: keys.bookings });
    },
    // Success or 409: either way the slot list changed.
    onSettled: () => qc.invalidateQueries({ queryKey: keys.slots(serviceId) }),
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancel(id),
    onSuccess: (booking: Booking) => {
      qc.setQueryData(keys.booking(booking.id), booking);
      qc.setQueryData<Booking[]>(keys.bookings, (old) => old?.map((b) => (b.id === booking.id ? booking : b)));
      void qc.invalidateQueries({ queryKey: keys.slots(booking.service.id) });
    },
  });
}

export const useAdminServices = (enabled = true) =>
  useQuery({ queryKey: keys.adminServices, queryFn: api.admin.services, enabled });

export function useSaveService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id?: string; input: ServiceInput | ServiceUpdate }) =>
      args.id ? api.admin.updateService(args.id, args.input) : api.admin.createService(args.input as ServiceInput),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminServices });
      void qc.invalidateQueries({ queryKey: keys.services });
    },
  });
}

export function useAddAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AvailabilityInput) => api.admin.addAvailability(input),
    onSuccess: (_slots, input) => qc.invalidateQueries({ queryKey: keys.slots(input.serviceId) }),
  });
}

export function useDeleteSlot(serviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId: string) => api.admin.deleteSlot(slotId),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.slots(serviceId) }),
  });
}
