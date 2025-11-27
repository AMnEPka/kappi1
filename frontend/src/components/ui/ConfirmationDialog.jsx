// components/ConfirmationDialog.jsx
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
  
  export const ConfirmationDialog = ({
    open,
    onOpenChange,
    title,
    description,
    confirmText = "ОК",
    cancelText = "Отмена",
    onConfirm,
    onCancel,
    variant = "default", // "default" | "destructive"
  }) => {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-2 pt-4">
            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={onConfirm}
            >
              {confirmText}
            </Button>
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
              >
                {cancelText}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };