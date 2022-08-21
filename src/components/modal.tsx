import {
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react-dom-interactions";
import { useId } from "react";
import { tinyassert } from "../utils/tinyassert";

export function Modal(props: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { floating, context } = useFloating({
    open: props.open,
    onOpenChange: (open) => {
      tinyassert(!open);
      props.onClose();
    },
  });
  const { getFloatingProps } = useInteractions([useDismiss(context)]);
  const id = useId();

  return (
    <FloatingPortal id={id}>
      {props.open && (
        <FloatingOverlay
          lockScroll
          className="flex justify-center items-center bg-black/[0.2] z-[100] h-full"
        >
          <div className="h-full" {...getFloatingProps({ ref: floating })}>
            {props.children}
          </div>
        </FloatingOverlay>
      )}
    </FloatingPortal>
  );
}
