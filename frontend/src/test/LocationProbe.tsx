import { useRef } from "react";
import { useLocation, useNavigate } from "react-router";

export const LOCATION_PROBE_ID = "test-location";
export const BACK_BUTTON_ID = "test-back";
export const ADDRESS_FIELD_ID = "test-address";
export const GO_BUTTON_ID = "test-go";

/**
 * Адрес, на котором стоит приложение, кнопка браузера «Назад» и переход по набранному
 * адресу: в тестах нет ни адресной строки, ни кнопок браузера.
 */
export function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  const address = useRef<HTMLInputElement>(null);
  return (
    <>
      <output id={LOCATION_PROBE_ID} hidden>
        {location.pathname + location.search + location.hash}
      </output>
      <button
        id={BACK_BUTTON_ID}
        type="button"
        hidden
        onClick={() => void navigate(-1)}
      />
      <input id={ADDRESS_FIELD_ID} ref={address} hidden readOnly />
      <button
        id={GO_BUTTON_ID}
        type="button"
        hidden
        onClick={() => void navigate(address.current?.value ?? "/")}
      />
    </>
  );
}
