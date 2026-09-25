// A pool of short, genuinely interesting food facts, shown one at a time
// during the "analyzing your meal" wait, rotating every 5 seconds so the
// wait feels shorter and a little more fun instead of a static spinner.
const FOOD_FACTS = [
  "Honey never spoils — archaeologists have found 3,000-year-old honey in Egyptian tombs that's still edible.",
  "Carrots were originally purple, not orange. Orange carrots were bred in the Netherlands in the 17th century.",
  "A single spaghetti noodle is called a 'spaghetto.'",
  "Bananas are berries, but strawberries aren't.",
  "Chili peppers are fruits, not vegetables — botanically speaking.",
  "The world's most expensive spice, saffron, requires about 75,000 crocus flowers to make just one pound.",
  "Rice is the staple food for more than half the world's population.",
  "Apples float because they're about 25% air by volume.",
  "The fear of cooking is called mageirocophobia.",
  "Peanuts aren't nuts — they're legumes, related to beans and lentils.",
  "It takes about 4 minutes to hard-boil an egg at sea level, but longer at higher altitudes.",
  "Broccoli has more protein per calorie than steak.",
  "Onions make you cry because they release a gas that reacts with the water in your eyes to form a mild acid.",
  "Cashews grow attached to the bottom of a fruit called a cashew apple.",
  "White chocolate isn't technically chocolate — it contains no cocoa solids, only cocoa butter.",
];

function startFoodFacts(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return null;

  let index = Math.floor(Math.random() * FOOD_FACTS.length);
  el.textContent = FOOD_FACTS[index];

  const intervalId = setInterval(() => {
    index = (index + 1) % FOOD_FACTS.length;
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = FOOD_FACTS[index];
      el.style.opacity = '1';
    }, 200);
  }, 5000);

  return intervalId;
}

function stopFoodFacts(intervalId) {
  if (intervalId) clearInterval(intervalId);
}
