/* MCP servers and the sample Claude conversations shown for each use case.
   Server URLs point at the utility's own tenant; tool names are illustrative and are
   finalized with the reference implementations. */

const MCP_SERVERS = {
  grid:    { id: "upro-grid",    name: "UtilityAI Pro · Grid & Planning", path: "grid",    who: "Planners, load research, regulatory",
             tools: ["get_network_load_shapes", "get_flexible_capacity", "run_nwa_scenario", "get_der_adoption"] },
  cx:      { id: "upro-cx",      name: "UtilityAI Pro · Customer Experience", path: "cx",  who: "CSRs, customer agents, digital teams",
             tools: ["analyze_bill", "get_bill_projection", "compare_rate_plans", "simulate_ev", "simulate_solar", "build_savings_plan", "get_appliance_breakdown"] },
  analyst: { id: "upro-analyst", name: "UtilityAI Pro · Energy Analyst", path: "analyst", who: "Analysts, program and marketing teams",
             tools: ["ask_energy_analyst", "build_segment", "simulate_program", "list_revenue_cases"] },
};

// One sample conversation per use case. Each turn: [role, text] or ["tool", name, argsJSON, resultJSON].
const UC_MCP = {
  forecast: { server: "grid",
    turns: [
      ["user", "What's driving the summer peak on Network 12, and how does it look in 2030?"],
      ["tool", "get_network_load_shapes", '{"network":"N-12","years":[2026,2030],"view":"peak_day"}', '{"peak_mw":{"2026":41.2,"2030":47.9},"design_criteria_mw":46.0,"peak_hour":"18:00","growth_by_end_use_mw":{"cooling":2.1,"ev":3.4,"heat_pump":0.6,"solar":-0.4}}'],
      ["assistant", "Network 12 peaks at 6pm on the design day. It is 41.2 MW today and forecast at 47.9 MW in 2030, which is 1.9 MW over its 46 MW design criteria. About half of the growth is residential EV charging (+3.4 MW), then cooling (+2.1 MW). Solar barely offsets the peak because it has faded by 6pm. I can export the 8760 end-use load shapes for your forecast model."],
    ] },
  flex: { server: "grid",
    turns: [
      ["user", "Which feeders have the most shiftable load between 4 and 8pm, and who should we target?"],
      ["tool", "get_flexible_capacity", '{"window":"16:00-20:00","season":"summer","exclude_enrolled":true}', '{"top_feeders":[{"id":"F-2231","flex_kw":1840,"ev":0.46,"hvac":0.41,"battery":0.13},{"id":"F-1187","flex_kw":1510}],"eligible_customers":6420}'],
      ["assistant", "F-2231 leads with 1.84 MW of shiftable load in the 4 to 8pm window: 46% EV charging, 41% HVAC and 13% batteries. F-1187 follows with 1.51 MW. Across the constrained feeders, 6,420 customers are not yet enrolled in DR or managed charging. I can publish them as a segment for your program team."],
    ] },
  nws: { server: "grid",
    turns: [
      ["user", "Can targeted flexibility defer the Network 7 load relief project?"],
      ["tool", "run_nwa_scenario", '{"network":"N-7","portfolio":["managed_charging","smart_thermostat_dr","battery_dispatch"]}', '{"overload_year":{"baseline":2029,"with_portfolio":2032},"relief_mw":2.6,"eligible_customers":3900,"deferral_years":3}'],
      ["assistant", "Yes, for about three years. Without action, Network 7 exceeds its rating in 2029. A portfolio of managed charging, smart thermostat DR and battery dispatch delivers 2.6 MW of relief from 3,900 eligible customers, which pushes the overload to 2032. I've drafted the pre- and post-program 8760s and a filing-ready summary."],
    ] },
  trend: { server: "grid",
    turns: [
      ["user", "Where is EV adoption growing fastest this year?"],
      ["tool", "get_der_adoption", '{"der":"ev","since":"2026-01-01","group_by":"network"}', '{"fastest":[{"network":"N-18","share":0.142,"growth_pts":4.1},{"network":"N-04","share":0.118,"growth_pts":3.6}],"unreported_detections":212}'],
      ["assistant", "N-18 is growing fastest: 14.2% of homes now charge an EV, up 4.1 points since January. N-04 follows at 11.8%. The model also found 212 home chargers with no matching interconnection or program record, worth a review by your interconnection team."],
    ] },
  highbill: { server: "cx",
    turns: [
      ["user", "Customer 40021887 is calling about a high bill. What changed?"],
      ["tool", "analyze_bill", '{"account":"40021887","cycle":"2026-08","compare":["prior_month","prior_year"]}', '{"bill":194,"prior":142,"drivers":[{"cooling_weather":38},{"ev":9},{"rate_change":6},{"days_in_cycle":3},{"lighting":-4}]}'],
      ["assistant", "The bill went from $142 to $194, up $52. Most of that is cooling during the August heat wave (+$38). EV charging added $9, the June rate change $6, and three extra billing days $3, while lighting went down $4. No billing anomalies were found. Suggest the TOU plan and pre-cooling before 4pm."],
    ] },
  alert: { server: "cx",
    turns: [
      ["user", "Which of my accounts are trending toward a high bill this cycle?"],
      ["tool", "get_bill_projection", '{"segment":"my_accounts","checkpoint_day":15,"threshold":0.4}', '{"flagged":[{"account":"40021887","baseline":120,"projected":171,"top_driver":"cooling"}],"count":1}'],
      ["assistant", "One account is flagged. 40021887 is projected at $171 against a $120 baseline, 42% higher, driven by cooling. The alert email with three cooling tips is queued for tomorrow morning."],
    ] },
  rates: { server: "cx",
    turns: [
      ["user", "Would this customer save on a TOU plan if they charge the EV overnight?"],
      ["tool", "compare_rate_plans", '{"account":"40021887","scenarios":["as_is","shift_ev"]}', '{"current":{"plan":"Standard","annual":2280},"best":{"plan":"TOU-EV","annual":1860,"with":"shift_ev"}}'],
      ["assistant", "Yes. On the Standard plan they pay about $2,280 a year. Moving to TOU-EV and charging after 11pm brings that to $1,860, saving $420 a year. About 70% of their EV charging already happens off-peak, so the change is small."],
    ] },
  assistant: { server: "cx",
    turns: [
      ["user", "Is rooftop solar worth it for my home?"],
      ["tool", "simulate_solar", '{"account":"40021887","sizing":"optimal"}', '{"system_kw":8.4,"net_cost":12900,"annual_savings":1820,"payback_years":7.1,"savings_25yr":32600}'],
      ["assistant", "Based on your actual usage, an 8.4 kW system fits best. After rebates it costs about $12,900 and saves $1,820 a year, so it pays back in about 7 years and saves around $32,600 over 25 years. A larger system would export more at a lower credit and pay back more slowly."],
    ] },
  web: { server: "cx",
    turns: [
      ["user", "Break down last month's bill by appliance."],
      ["tool", "get_appliance_breakdown", '{"account":"40021887","cycle":"2026-08","unit":"usd"}', '{"total":194,"cooling":88,"ev":31,"always_on":24,"pool_pump":18,"water_heating":14,"other":19}'],
      ["assistant", "August came to $194. Cooling was $88 (45%), EV charging $31, always-on devices $24, the pool pump $18, water heating $14 and everything else $19."],
    ] },
  targeting: { server: "analyst",
    turns: [
      ["user", "Build a heat pump outreach list: electric resistance heat, likely income-qualified, not already in a program."],
      ["tool", "build_segment", '{"filters":{"heating_fuel":"electric","heat_pump":false,"lmi_likelihood":">=0.5","enrolled":false}}', '{"count":18240,"avg_winter_kwh":2140,"export":"segments/hp_lmi_q4.csv"}'],
      ["assistant", "The segment has 18,240 homes, averaging 2,140 kWh a month in winter. It's saved as hp_lmi_q4 and ready to export to your campaign tool. Want me to simulate expected enrollment and savings?"],
    ] },
  analyst: { server: "analyst",
    turns: [
      ["user", "How many homes added an EV this year, by network?"],
      ["tool", "ask_energy_analyst", '{"question":"new EV detections since 2026-01-01 by network"}', '{"sql":"SELECT network, COUNT(*) FROM upro.ev_detections WHERE first_seen >= \'2026-01-01\' GROUP BY 1","rows":[["N-18",1204],["N-04",988],["N-12",760],["N-07",512]]}'],
      ["assistant", "3,464 homes added an EV this year across the top four networks: N-18 with 1,204, N-04 with 988, N-12 with 760 and N-07 with 512. The query ran against the governed EV detections table; I've included it so you can reuse it."],
    ] },
  revenue: { server: "analyst",
    turns: [
      ["user", "Show this week's priority revenue protection cases."],
      ["tool", "list_revenue_cases", '{"priority":1,"since":"7d"}', '{"cases":[{"meter":"M-55120","category":"tampering","drop":0.58,"est_monthly_kwh":410}],"count":14}'],
      ["assistant", "There are 14 priority-1 cases this week. The top one is meter M-55120: usage dropped 58% with no change in weather or occupancy, and it matches a meter-cover event, so it's categorized as tampering. It's about 410 kWh a month unbilled."],
    ] },
};
