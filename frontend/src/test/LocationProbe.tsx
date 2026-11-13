import { useLocation, useNavigate } from "react-router";

export const LOCATION_PROBE_ID = "test-location";
export const BACK_BUTTON_ID = "test-back";

/**
 * Адрес, на котором стоит приложение, и кнопка браузера «Назад»: в тестах нет
 * ни адресной строки, ни кнопок браузера.
 */
export function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output id={LOCATION_PROBE_ID} hidden>
        {location.pathname + location.search}
      </output>
      <button
        id={BACK_BUTTON_ID}
        type="button"
        hidden
        onClick={() => void navigate(-1)}
      />
    </>
  );
}
