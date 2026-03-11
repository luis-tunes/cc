import { useUser } from "@clerk/react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Profile hook backed by Clerk user metadata.
 * Wraps Clerk's useUser to provide a compatible API.
 */
export function useProfile() {
  const { user, isLoaded } = useUser();

  const profile = user
    ? {
        full_name: user.fullName || "",
        phone: user.primaryPhoneNumber?.phoneNumber || "",
        job_title: (user.unsafeMetadata?.job_title as string) || "",
        locale: (user.unsafeMetadata?.locale as string) || "pt-PT",
        notifications_email:
          (user.unsafeMetadata?.notifications_email as boolean) ?? true,
        notifications_push:
          (user.unsafeMetadata?.notifications_push as boolean) ?? true,
        avatar_url: user.imageUrl,
      }
    : null;

  const updateProfile = useMutation({
    mutationFn: async (data: {
      full_name?: string;
      phone?: string;
      job_title?: string;
      locale?: string;
      notifications_email?: boolean;
      notifications_push?: boolean;
    }) => {
      if (!user) throw new Error("Not signed in");

      await user.update({
        firstName: data.full_name?.split(" ")[0],
        lastName: data.full_name?.split(" ").slice(1).join(" "),
        unsafeMetadata: {
          ...user.unsafeMetadata,
          job_title: data.job_title,
          locale: data.locale,
          notifications_email: data.notifications_email,
          notifications_push: data.notifications_push,
        },
      });
    },
    onSuccess: () => toast.success("Perfil atualizado"),
    onError: () => toast.error("Erro ao atualizar perfil"),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not signed in");
      await user.setProfileImage({ file });
    },
    onSuccess: () => toast.success("Foto atualizada"),
    onError: () => toast.error("Erro ao atualizar foto"),
  });

  return {
    profile,
    isLoading: !isLoaded,
    updateProfile,
    uploadAvatar,
  };
}
