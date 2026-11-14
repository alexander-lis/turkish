import { useRef, type MouseEvent } from "react";

interface BackdropHandlers {
  onMouseDown: (event: MouseEvent<HTMLDialogElement>) => void;
  onClick: (event: MouseEvent<HTMLDialogElement>) => void;
}

/**
 * Нажатие на затемнение вокруг модального <dialog>: обработчики для самого окна.
 * Содержимое должно занимать всю площадь окна — тогда нажатие на сам <dialog> и есть
 * нажатие на затемнение. Не считаются выделение текста, отпущенное за краем окна,
 * и второе нажатие двойного щелчка, которым окно только что открыли.
 */
export function useBackdropPress(onPress: () => void): BackdropHandlers {
  const pressedBackdrop = useRef(false);
  return {
    onMouseDown(event) {
      pressedBackdrop.current =
        event.target === event.currentTarget && event.detail <= 1;
    },
    onClick(event) {
      if (pressedBackdrop.current && event.target === event.currentTarget) {
        onPress();
      }
      pressedBackdrop.current = false;
    },
  };
}
