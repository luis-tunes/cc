import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: (number | string)[];
}

export function MobileDrawer({
  open,
  onClose,
  children,
  snapPoints,
}: MobileDrawerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      snapPoints={snapPoints}
    >
      <DrawerContent className="max-h-[92vh] pb-safe">
        <div className="overflow-y-auto overscroll-contain px-4 pb-6">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
