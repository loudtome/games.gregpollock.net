# Category icons

Drop an SVG here named after the issue category's slug and it will appear
automatically on that category's newspaper badge in the encounter modal.

- Filename: `<slug>.svg`, where the slug is the category lowercased with every
  run of non-alphanumeric characters replaced by a single hyphen.
- Examples: `Anti-Vaccine` → `anti-vaccine.svg`, `School Culture Wars` →
  `school-culture-wars.svg`, `Right Wing Conspiracies` →
  `right-wing-conspiracies.svg`.
- Icons are recolored to white to sit on the colored badge (via a CSS
  `brightness(0) invert(1)` filter), so a single-color silhouette works best.
- Missing files remove themselves gracefully — the badge just shows the label.

Categories in the dataset: Anti-Vaccine, Donor Giveaways, School Culture Wars,
Anti-Reproductive Rights, Right Wing Conspiracies, Increasing Electricity Costs,
Pro-Gun Extremism, Anti-LGBT, Quack Medicine, Anti-Democracy, Anti-Worker,
Cult of Personality, Defund Schools, Dirty Air and Water, Food Poisoning,
Culture War, Anti-Money, Constitutional Crisis, Blood and Soil,
End No Fault Divorce, Bad Doctors, Anti-Patriotism, Interstate Aggression,
Animal Cruelty, Anti-Consumer, Pro-Violence, Increase Housing Costs,
Pro-Discrimination, Pro-Iran, Unsafe Driving, Cult Veneration.
