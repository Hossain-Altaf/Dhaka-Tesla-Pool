# Fare Model

Money is stored as integer poisha (`100 poisha = Tk 1`). Floating point is not used for stored or summed fare values.

```text
area distance = |x_pickup - x_dropoff| + |y_pickup - y_dropoff| km
unpooled fare = 2,500 + 1,200 × distance_km poisha
pooled fare = round(unpooled fare × 0.80) poisha
```

The fixed grid is deliberately approximate, not a road map:

| Area | x | y |
| --- | ---: | ---: |
| Banani | 0 | 0 |
| Mohakhali | 3 | 0 |
| Gulshan 1 | 3 | 2 |
| Dhanmondi | -4 | 0 |
| Mirpur | -2 | 5 |
| Uttara | 3 | 10 |
| Farmgate | -2 | 2 |
| Bashundhara | 6 | 3 |

| Rider | Route | Distance | Before discount | Matched pool fare |
| --- | --- | ---: | ---: | ---: |
| Nusrat | Banani → Mohakhali | 3 km | Tk 61.00 | Tk 48.80 |
| Rafiq | Banani → Gulshan 1 | 5 km | Tk 85.00 | Tk 68.00 |

Each rider keeps an independent `ride_requests.fare_paisa`; no shared total is divided. Requests show the undiscounted estimate until a driver accepts, when the individual 20% pool fare is stored. Seed, API and tests share the same formula.

Compatibility is intentionally simple: pickup zones must match exactly; destinations may differ. Replacing this with actual routing or route overlap requires a documented model change and test updates.