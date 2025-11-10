import React, { useState, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import "./index.css";

const QUOTES = [
  "Consistency beats intensity — every time.",
  "Small daily improvements lead to big results.",
  "Progress, not perfection.",
  "Eat clean, train dirty.",
  "Your body is a reflection of your lifestyle."
];

export default function App() {
  const [theme, setTheme] = useState("dark");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("");
  const [goal, setGoal] = useState("");
  const [dietType, setDietType] = useState("");
  const [intensity, setIntensity] = useState("");

  const [loading, setLoading] = useState(false);

  // results
  const [bmi, setBmi] = useState(null);
  const [bmr, setBmr] = useState(null);
  const [zigzagCalories, setZigzagCalories] = useState([]);
  const [dietPlan, setDietPlan] = useState([]);
  const [caloriesMap, setCaloriesMap] = useState(null);
  const [macros, setMacros] = useState(null);
  const [quote, setQuote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  const summaryRef = useRef();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const isDark = theme === "dark";

  const activityFactorFromChoice = (choice) => {
    switch (choice) {
      case "1": return 1.2;
      case "2": return 1.275;
      case "3-5": return 1.55;
      case "6-7": return 1.725;
      case "daily-intense": return 1.9;
      default: return 1.375;
    }
  };

  const calculate = () => {
    if (!gender || !age || !heightFeet || !weight || !activity || !goal) {
      alert("Please fill: gender, age, height (ft), weight, activity and goal.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const totalInches = Number(heightFeet) * 12 + Number(heightInches || 0);
      const heightCm = totalInches * 2.54;
      const heightM = heightCm / 100;
      const weightKg = Number(weight);

      const bmiVal = +(weightKg / (heightM * heightM)).toFixed(1);
      setBmi(bmiVal);

      const bmrCalc = gender === "male"
        ? 10 * weightKg + 6.25 * heightCm - 5 * Number(age) + 5
        : 10 * weightKg + 6.25 * heightCm - 5 * Number(age) - 161;
      setBmr(Math.round(bmrCalc));

      const actFactor = activityFactorFromChoice(activity);
      const maintain = Math.round(bmrCalc * actFactor);

      const mild = Math.round(maintain * 0.9);
      const weightLoss = Math.round(maintain * 0.8);
      const extreme = Math.round(maintain * 0.61);
      setCaloriesMap({ maintain, mild, weight: weightLoss, extreme });

      const proteinG = Math.round(weightKg * (goal === "gain" ? 1.8 : 1.5));

      let proteinCalories = proteinG * 4;
      let totalCalories = maintain;
      const defaultProteinPercent = 0.25;
      const defaultProteinCals = totalCalories * defaultProteinPercent;
      let carbsCals, fatCals;

      if (proteinCalories > defaultProteinCals) {
        const remainingCals = Math.max(0, totalCalories - proteinCalories);
        carbsCals = Math.round(remainingCals * 0.66);
        fatCals = Math.round(remainingCals * 0.34);
      } else {
        proteinCalories = Math.round(totalCalories * defaultProteinPercent);
        carbsCals = Math.round(totalCalories * 0.5);
        fatCals = Math.round(totalCalories * 0.25);
        const proteinFromPercentG = Math.round(proteinCalories / 4);
        if (proteinFromPercentG < proteinG) {
          const extraProtCals = (proteinG - proteinFromPercentG) * 4;
          proteinCalories += extraProtCals;
          carbsCals = Math.max(0, carbsCals - Math.round(extraProtCals * 0.7));
          fatCals = Math.max(0, fatCals - Math.round(extraProtCals * 0.3));
        }
      }

      const proteinGram = Math.round(proteinCalories / 4);
      const carbsGram = Math.round(carbsCals / 4);
      const fatGram = Math.round(fatCals / 9);
      setMacros({ protein: proteinGram, carbs: carbsGram, fat: fatGram });

      const { scheduleA } = generateZigzagSchedules(maintain, goal);
      setZigzagCalories(scheduleA);

      setDietPlan(buildDietPlanWithQuantities(
        goal === "lose"
          ? (intensity === "mild" ? mild : intensity === "moderate" ? weightLoss : extreme)
          : goal === "gain"
            ? (intensity === "mild" ? Math.round(maintain * 1.05) : intensity === "moderate" ? Math.round(maintain * 1.1) : Math.round(maintain * 1.15))
            : maintain,
        proteinG,
        dietType
      ));

      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
      setLoading(false);
    }, 1600);
  };

  const generateZigzagSchedules = (maintain, goalChoice) => {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const scheduleA = days.map((d,i) => {
      const weekendBoost = (i === 0 || i === 6) ? 1.05 : 1.0;
      if (goalChoice === "lose") {
        return { day: d, mild: Math.round(maintain * 0.9 * weekendBoost), moderate: Math.round(maintain * 0.85 * weekendBoost), extreme: Math.round(maintain * 0.8 * weekendBoost) };
      } else if (goalChoice === "gain") {
        return { day: d, mild: Math.round(maintain * 1.05 * weekendBoost), moderate: Math.round(maintain * 1.1 * weekendBoost), extreme: Math.round(maintain * 1.15 * weekendBoost) };
      } else {
        return { day: d, mild: Math.round(maintain * 1.0 * weekendBoost), moderate: Math.round(maintain * 1.02 * weekendBoost), extreme: Math.round(maintain * 1.05 * weekendBoost) };
      }
    });
    return { scheduleA };
  };

  const buildDietPlanWithQuantities = (dailyCalories, proteinTargetG, dietTypeChoice) => {
    const preC = Math.round(dailyCalories * 0.10);
    const breakfastC = Math.round(dailyCalories * 0.25);
    const lunchC = Math.round(dailyCalories * 0.30);
    const snackC = Math.round(dailyCalories * 0.10);
    const dinnerC = Math.round(dailyCalories * 0.25);

    const scale = dailyCalories / 2000;

    const protBreakfast = Math.round(proteinTargetG * 0.2);
    const protLunch = Math.round(proteinTargetG * 0.35);
    const protSnack = Math.round(proteinTargetG * 0.1);
    const protDinner = Math.round(proteinTargetG * 0.35);

    const gramsFromProtein = (wantG, proteinPer100g) => Math.round((wantG / proteinPer100g) * 100);

    let breakfastText;
    if (dietTypeChoice === "veg") {
      const oatsG = Math.round(40 * scale);
      const milkMl = Math.round(250 * scale);
      const paneerG = gramsFromProtein(protBreakfast, 18);
      breakfastText = `Breakfast (~${breakfastC} kcal): Oats ${oatsG}g + Milk ${milkMl}ml + Paneer ${paneerG}g (≈${protBreakfast}g protein) + 8–10 almonds.`;
    } else {
      const oatsG = Math.round(40 * scale);
      const milkMl = Math.round(250 * scale);
      const extraProtNeeded = Math.max(0, protBreakfast - 12);
      const chickenG = extraProtNeeded > 0 ? gramsFromProtein(extraProtNeeded, 31) : 0;
      breakfastText = `Breakfast (~${breakfastC} kcal): Oats ${oatsG}g + Milk ${milkMl}ml + 3 egg whites (~12g)${chickenG ? ` + ${chickenG}g chicken (~${extraProtNeeded}g protein)` : ""}.`;
    }

    let lunchText;
    if (dietTypeChoice === "veg") {
      const riceG = Math.round(180 * scale);
      const paneerG = gramsFromProtein(protLunch, 18);
      lunchText = `Lunch (~${lunchC} kcal): Rice ${riceG}g + Paneer ${paneerG}g (≈${protLunch}g protein) + Mixed veg 100g + Salad 100g.`;
    } else {
      const riceG = Math.round(180 * scale);
      const chickenG = gramsFromProtein(protLunch, 31);
      lunchText = `Lunch (~${lunchC} kcal): Rice ${riceG}g + Chicken ${chickenG}g (≈${protLunch}g protein) or 3-egg omelette + Mixed veg 100g + Salad 100g.`;
    }

    const snackText = `Snack (~${snackC} kcal): Sprout salad 100g (sprouts, onion, tomato, cucumber) + 1 fruit if needed. (Protein ≈ ${protSnack}g).`;

    let dinnerText;
    if (dietTypeChoice === "veg") {
      const riceG = Math.round(150 * scale);
      const paneerG = gramsFromProtein(protDinner, 18);
      dinnerText = `Dinner (~${dinnerC} kcal): Rice ${riceG}g or 2 chapatis + Paneer ${paneerG}g (≈${protDinner}g protein) + Veggies 100g + Salad 100g.`;
    } else {
      const riceG = Math.round(150 * scale);
      const chickenG = gramsFromProtein(protDinner, 31);
      dinnerText = `Dinner (~${dinnerC} kcal): Rice ${riceG}g or 2 chapatis + Chicken/Fish ${chickenG}g (≈${protDinner}g protein) + Veggies 100g + Salad 100g.`;
    }

    const preText = `Pre-workout (~${preC} kcal): 1 medium banana (~100g) or 1 slice toast with peanut butter.`;

    return [preText, breakfastText, lunchText, snackText, dinnerText];
  };

  const downloadSummary = async () => {
    if (!summaryRef.current) return;
    const canvas = await html2canvas(summaryRef.current, { scale: 3 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = 210;
    const imgProps = pdf.getImageProperties(imgData);
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.setFontSize(16);
    pdf.setTextColor(220, 170, 20);
    pdf.text("MaddyLiftz — Fitness Summary", 14, 18);
    pdf.addImage(imgData, "PNG", 0, 24, pdfWidth, pdfHeight);
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Built by MaddyLiftz | @maddymadhuu`, 14, pdfHeight + 36);
    pdf.save(`${name || "client"}_MaddyLiftz_Summary.pdf`);
  };

  const waterRecommendation = () => {
    if (!weight) return null;
    const liters = (Number(weight) * 0.04).toFixed(1);
    return `${liters} L/day (approx)`;
  };

  return (
    <div
      className={`min-vh-100 d-flex flex-column justify-content-center align-items-center p-3 text-${isDark ? "white" : "dark"}`}
      style={{
        background: isDark
          ? "linear-gradient(to right, #000000, #0f2027, #203a43, #2c5364)"
          : "linear-gradient(to right, #f8f9fa, #e0e0e0)",
        transition: "0.5s ease-in-out",
      }}
    >
      <div
        className={`p-4 rounded-4 shadow-lg w-100`}
        style={{
          backgroundColor: isDark
            ? "rgba(0,0,0,0.85)"
            : "rgba(255,255,255,0.95)",
          maxWidth: "920px",
          transition: "0.4s ease",
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className={`fw-bold ${isDark ? "text-warning" : "text-primary"}`}>
            💪 MaddyLiftz — Fitness Planner
          </h2>
          <div className="d-flex align-items-center gap-2">
            <div className="small text-muted me-2">@maddymadhuu</div>
            <button
              className="btn btn-sm btn-outline-secondary rounded-pill"
              onClick={toggleTheme}
            >
              {isDark ? "🌞 Light" : "🌙 Dark"}
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="row g-3">
          <div className="col-12 col-md-3">
            <label className="form-label">Name</label>
            <input
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name"
            />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label">Gender</label>
            <select
              className="form-select"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label">Age</label>
            <input
              className="form-control"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
          <div className="col-3 col-md-2">
            <label className="form-label">Height (ft)</label>
            <input
              className="form-control"
              type="number"
              value={heightFeet}
              onChange={(e) => setHeightFeet(e.target.value)}
            />
          </div>
          <div className="col-3 col-md-2">
            <label className="form-label">In</label>
            <input
              className="form-control"
              type="number"
              value={heightInches}
              onChange={(e) => setHeightInches(e.target.value)}
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Weight (kg)</label>
            <input
              className="form-control"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Workout Frequency</label>
            <select
              className="form-select"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
            >
              <option value="">Select</option>
              <option value="1">Once a week</option>
              <option value="2">Twice a week</option>
              <option value="3-5">3–5 days/week</option>
              <option value="6-7">6–7 days/week</option>
              <option value="daily-intense">Daily intense</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">Goal</label>
            <select
              className="form-select"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            >
              <option value="">Select</option>
              <option value="maintain">Maintain</option>
              <option value="lose">Lose Weight</option>
              <option value="gain">Gain Weight</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">Diet Type</label>
            <select
              className="form-select"
              value={dietType}
              onChange={(e) => setDietType(e.target.value)}
            >
              <option value="">Select</option>
              <option value="nonveg">Non-Veg</option>
              <option value="veg">Veg</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">Intensity</label>
            <select
              className="form-select"
              value={intensity}
              onChange={(e) => setIntensity(e.target.value)}
            >
              <option value="">Select</option>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="extreme">Extreme</option>
            </select>
          </div>
        </div>

        <div className="text-center mt-4">
          <button
            className="btn btn-warning fw-bold px-4 py-2"
            onClick={calculate}
            disabled={loading}
          >
            {loading ? "Calculating your personalized fitness plan..." : "Calculate Plan"}
          </button>
        </div>

        {bmr && (
          <div ref={summaryRef} className="mt-5">
            <h4 className="text-center text-warning mb-3">Calorie & Macro Summary</h4>
            <div className="table-responsive">
              <table className={`table table-${isDark ? "dark" : "light"} text-center align-middle`}>
                <thead>
                  <tr>
                    <th>Goal</th>
                    <th>Calories / Day</th>
                    <th>% of Maintain</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Maintain Weight</td>
                    <td>{caloriesMap.maintain}</td>
                    <td>100%</td>
                  </tr>
                  <tr>
                    <td>Mild {goal === "gain" ? "Gain" : "Weight Loss"}</td>
                    <td>{goal === "gain" ? Math.round(caloriesMap.maintain * 1.05) : caloriesMap.mild}</td>
                    <td>{goal === "gain" ? "105%" : "90%"}</td>
                  </tr>
                  <tr>
                    <td>{goal === "gain" ? "Moderate Gain" : "Weight Loss"}</td>
                    <td>{goal === "gain" ? Math.round(caloriesMap.maintain * 1.1) : caloriesMap.weight}</td>
                    <td>{goal === "gain" ? "110%" : "80%"}</td>
                  </tr>
                  <tr>
                    <td>{goal === "gain" ? "Extreme Gain" : "Extreme Weight Loss"}</td>
                    <td>{goal === "gain" ? Math.round(caloriesMap.maintain * 1.15) : caloriesMap.extreme}</td>
                    <td>{goal === "gain" ? "115%" : "61%"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h5 className="mt-4 text-warning">Macros:</h5>
            <p>
              Protein: {macros.protein}g | Carbs: {macros.carbs}g | Fat: {macros.fat}g
            </p>

            <h5 className="mt-4 text-warning">Daily Plan:</h5>
            <ul>
              {dietPlan.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>

            <h5 className="mt-4 text-warning">Hydration:</h5>
            <p>Recommended Water Intake: {waterRecommendation()}</p>

            <div className="text-center mt-4">
              <button
                className="btn btn-outline-warning fw-bold"
                onClick={downloadSummary}
              >
                Download PDF Summary
              </button>
            </div>

            <div className="text-center mt-4">
              <blockquote className="fst-italic text-secondary">“{quote}”</blockquote>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
