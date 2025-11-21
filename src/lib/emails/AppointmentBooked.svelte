<script lang="js">
  import { m } from "$i18n/messages";
  import { getLocale, setLocale } from "$i18n/runtime";
  import EmailButton from "./components/EmailButton.svelte";
  import EmailLayout from "./components/EmailLayout.svelte";
  import EmailText from "./components/EmailText.svelte";

  let { name, locale } = $props();

  setLocale(locale);
  console.log("Locale in AppointmentBooked:", getLocale());
</script>

<EmailLayout>
  <p>{m["absences.add.description"]()} {name},</p>
  <p>your appointment has been booked.</p>
  <h2>Vaccination Appointment</h2>
  <p>
    Dr. John Doe<br />
    June 30, 2024<br />
    10:00 AM - 10:15 AM
  </p>
  <h2>Praxis Dr. Jane Doe</h2>
  <p>
    Musterstraße 10<br />
    Etage 4<br />
    12345 Musterstadt
  </p>
  <EmailButton href="https://open-reception.org/appointments">View Appointments</EmailButton>
  <EmailText variant="md" color="text-light">
    You are receiving this email because someone booked an appointment with your e-mail address.
  </EmailText>
</EmailLayout>
