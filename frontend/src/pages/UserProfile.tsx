import { useState, useEffect, useRef } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { useProfile } from "@/hooks/use-profile";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Camera, Save, User, Bell, Globe } from "lucide-react";

export default function UserProfile() {
  const { user } = useUser();
  const { profile, isLoading, updateProfile, uploadAvatar } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    job_title: "",
    locale: "pt-PT",
    notifications_email: true,
    notifications_push: true,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        job_title: profile.job_title || "",
        locale: profile.locale || "pt-PT",
        notifications_email: profile.notifications_email,
        notifications_push: profile.notifications_push,
      });
    }
  }, [profile]);

  const handleSave = () => {
    updateProfile.mutate(form);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAvatar.mutate(file);
  };

  const initials = (form.full_name || user?.primaryEmailAddress?.emailAddress || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (isLoading) {
    return (
      <PageContainer title="O Meu Perfil">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="O Meu Perfil"
      subtitle="Gerir informações pessoais e preferências"
      actions={
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={handleSave}
          disabled={updateProfile.isPending}
        >
          {updateProfile.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          Guardar alterações
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Avatar & Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-primary" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="relative">
                <Avatar className="h-16 w-16 border-2 border-border">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground transition-transform hover:scale-105"
                  aria-label="Alterar foto de perfil"
                >
                  {uploadAvatar.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Camera className="h-3 w-3" />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {form.full_name || "Sem nome"}
                </p>
                <p className="text-xs text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
            </div>

            <Separator />

            {/* Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="text-xs">
                  Nome completo
                </Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, full_name: e.target.value }))
                  }
                  placeholder="João Silva"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="job_title" className="text-xs">
                  Cargo / Função
                </Label>
                <Input
                  id="job_title"
                  value={form.job_title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, job_title: e.target.value }))
                  }
                  placeholder="Contabilista"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="email"
                  value={user?.primaryEmailAddress?.emailAddress || ""}
                  disabled
                  className="opacity-60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs">
                  Telefone
                </Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+351 912 345 678"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-primary" />
              Preferências
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Idioma</Label>
              <Select
                value={form.locale}
                onValueChange={(v) => setForm((f) => ({ ...f, locale: v }))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-PT">Português (PT)</SelectItem>
                  <SelectItem value="pt-BR">Português (BR)</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-primary" />
              Notificações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Notificações por email
                </p>
                <p className="text-xs text-muted-foreground">
                  Receber alertas e resumos por email
                </p>
              </div>
              <Switch
                checked={form.notifications_email}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, notifications_email: v }))
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Notificações push
                </p>
                <p className="text-xs text-muted-foreground">
                  Receber notificações no navegador
                </p>
              </div>
              <Switch
                checked={form.notifications_push}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, notifications_push: v }))
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
