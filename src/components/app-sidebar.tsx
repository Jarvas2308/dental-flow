import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  Stethoscope,
  FlaskConical,
  Settings,
  LogOut,
  TrendingUp,
  PiggyBank,
  HandCoins,
  CalendarClock,
  PhoneCall,
  Users,
  Activity,
  Menu,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth-context";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useAppSettings, useUpdateLogo } from "@/hooks/use-logo";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/fluxo-caixa", label: "Fluxo", icon: TrendingUp },
  { to: "/contas", label: "Contas", icon: Wallet },
  { to: "/contas-receber", label: "A Receber", icon: HandCoins },
  { to: "/ganhos", label: "Ganhos", icon: PiggyBank },
  { to: "/consultorio", label: "Consultório", icon: Stethoscope },
  { to: "/pacientes", label: "Pacientes", icon: Users },
  { to: "/consultas", label: "Consultas", icon: CalendarClock },
  { to: "/followup", label: "Follow-up", icon: PhoneCall },
  { to: "/dtm", label: "DTM", icon: Activity },
  { to: "/laboratorio", label: "Laboratório", icon: FlaskConical },
  { to: "/cadastros", label: "Cadastros", icon: Settings },
] as const;

const mobilePrimaryPaths = [
  "/dashboard",
  "/consultorio",
  "/fluxo-caixa",
  "/contas",
  "/contas-receber",
] as const;

const mobilePrimary = mobilePrimaryPaths.map((p) => items.find((i) => i.to === p)!);

const mobileMore = items.filter((i) => !(mobilePrimaryPaths as readonly string[]).includes(i.to));

function LogoBadge() {
  const { data: settings } = useAppSettings();
  const updateLogo = useUpdateLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [size, setSize] = useState(settings?.logo_size ?? 36);

  useEffect(() => {
    if (settings?.logo_size && !pendingFile) setSize(settings.logo_size);
  }, [settings?.logo_size, pendingFile]);

  const currentUrl = previewUrl ?? settings?.logo_url;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleSave() {
    updateLogo.mutate(
      { file: pendingFile ?? undefined, size },
      {
        onSuccess: () => {
          setPendingFile(null);
          setPreviewUrl(null);
        },
      },
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 rounded-xl grid place-items-center text-primary-foreground font-bold overflow-hidden hover:opacity-90 transition-opacity"
          style={{
            width: settings?.logo_size ?? 36,
            height: settings?.logo_size ?? 36,
            ...(currentUrl ? {} : { background: "var(--gradient-primary)" }),
          }}
          aria-label="Alterar logo"
        >
          {currentUrl ? (
            <img src={currentUrl} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            "O"
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-4">
        <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-4">
          <div
            className="rounded-xl grid place-items-center overflow-hidden bg-background border"
            style={{ width: size, height: size }}
          >
            {currentUrl ? (
              <img src={currentUrl} alt="Prévia da logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">Sem logo</span>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <Upload className="h-4 w-4" />
          {pendingFile ? pendingFile.name : "Escolher arquivo"}
        </button>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tamanho</span>
            <span>{size}px</span>
          </div>
          <Slider
            min={24}
            max={160}
            step={2}
            value={[size]}
            onValueChange={([v]) => setSize(v)}
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={updateLogo.isPending}
          className="w-full rounded-lg bg-primary text-primary-foreground text-sm font-medium py-2 disabled:opacity-50"
        >
          {updateLogo.isPending ? "Salvando..." : "Salvar"}
        </button>
      </PopoverContent>
    </Popover>
  );
}

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { signOut, user } = useAuth();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="px-6 py-6">
        <div className="flex items-center gap-2.5">
          <LogoBadge />
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">Anna Julia</div>
            <div className="text-xs text-muted-foreground">Odontologia</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {items.map(({ to, label, icon: Icon }) => {
          const active = path === to || path.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t mt-2">
        <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user?.email}</div>
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const moreActive = mobileMore.some(({ to }) => path === to || path.startsWith(to + "/"));

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-card/95 backdrop-blur">
        <div className="grid grid-cols-6">
          {mobilePrimary.map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
          <button
            onClick={() => setOpen(true)}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[10px]",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Menu className="h-4 w-4" />
            Mais
          </button>
        </div>
      </nav>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Mais opções</DrawerTitle>
          </DrawerHeader>
          <div className="grid grid-cols-3 gap-3 p-4">
            {mobileMore.map(({ to, label, icon: Icon }) => {
              const active = path === to || path.startsWith(to + "/");
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-xs",
                    active
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-muted bg-muted/40 text-muted-foreground",
                  )}
                >
                  <Icon className="h-6 w-6" />
                  {label}
                </Link>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
