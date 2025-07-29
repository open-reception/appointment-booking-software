<script lang="ts">
	import { m } from "$i18n/messages.js";
	import { getLocale, setLocale } from "$i18n/runtime.js";
	import { ComboBox } from "$lib/components/ui/combobox";
</script>

<div>
	<ComboBox
		options={[
			{ label: "Deutsch", value: "de", keywords: ["german", "deutsch"] },
			{ label: "English", value: "en", keywords: ["english"] }
		]}
		value={getLocale()}
		onChange={(value) => {
			setLocale(value as "de" | "en");
		}}
		labels={{
			placeholder: m["i18n.label"](),
			search: m["i18n.search"](),
			notFound: m["i18n.notFound"]()
		}}
	/>
</div>
