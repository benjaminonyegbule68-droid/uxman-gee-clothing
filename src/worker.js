export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/api/health") {
      return Response.json({
        success: true,
        service: "Uxman Gee Clothing",
        status: "online"
      });
    }

    // Submit a customer review
    if (url.pathname === "/api/reviews" && request.method === "POST") {
      try {
        const data = await request.json();

        const name = String(data.name || "").trim();
        const review = String(data.review || "").trim();

        if (!name || !review) {
          return Response.json(
            { success: false, error: "Name and review are required." },
            { status: 400 }
          );
        }

        if (name.length > 100 || review.length > 1000) {
          return Response.json(
            { success: false, error: "Review is too long." },
            { status: 400 }
          );
        }

        await env.DB.prepare(
          `INSERT INTO reviews (name, review, status)
           VALUES (?, ?, 'pending')`
        )
          .bind(name, review)
          .run();

        return Response.json({
          success: true,
          message: "Thank you! Your review has been submitted for approval."
        });
      } catch (error) {
        return Response.json(
          { success: false, error: "Unable to submit review." },
          { status: 500 }
        );
      }
    }

    // Get approved reviews
    if (url.pathname === "/api/reviews" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(
          `SELECT id, name, review, created_at
           FROM reviews
           WHERE status = 'approved'
           ORDER BY created_at DESC`
        ).all();

        return Response.json({
          success: true,
          reviews: result.results || []
        });
      } catch (error) {
        return Response.json(
          { success: false, error: "Unable to load reviews." },
          { status: 500 }
        );
      }
    }

    // Admin login
    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      try {
        const data = await request.json();
        const password = String(data.password || "");

        if (!env.ADMIN_PASSWORD) {
          return Response.json(
            { success: false, error: "Admin password is not configured." },
            { status: 500 }
          );
        }

        if (password !== env.ADMIN_PASSWORD) {
          return Response.json(
            { success: false, error: "Incorrect password." },
            { status: 401 }
          );
        }

        return Response.json({
          success: true,
          message: "Login successful."
        });
      } catch (error) {
        return Response.json(
          { success: false, error: "Login failed." },
          { status: 500 }
        );
      }
    }

    // Admin: view pending reviews
    if (url.pathname === "/api/admin/reviews" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(
          `SELECT id, name, review, status, created_at
           FROM reviews
           ORDER BY created_at DESC`
        ).all();

        return Response.json({
          success: true,
          reviews: result.results || []
        });
      } catch (error) {
        return Response.json(
          { success: false, error: "Unable to load admin reviews." },
          { status: 500 }
        );
      }
    }

    // Admin: approve/delete a review
    if (url.pathname === "/api/admin/reviews" && request.method === "PATCH") {
      try {
        const data = await request.json();
        const id = Number(data.id);
        const action = String(data.action || "");

        if (!Number.isInteger(id)) {
          return Response.json(
            { success: false, error: "Invalid review ID." },
            { status: 400 }
          );
        }

        if (action === "approve") {
          await env.DB.prepare(
            `UPDATE reviews SET status = 'approved' WHERE id = ?`
          )
            .bind(id)
            .run();
        } else if (action === "delete") {
          await env.DB.prepare(
            `DELETE FROM reviews WHERE id = ?`
          )
            .bind(id)
            .run();
        } else {
          return Response.json(
            { success: false, error: "Invalid action." },
            { status: 400 }
          );
        }

        return Response.json({ success: true });
      } catch (error) {
        return Response.json(
          { success: false, error: "Unable to update review." },
          { status: 500 }
        );
      }
    }

    // Submit an order
    if (url.pathname === "/api/orders" && request.method === "POST") {
      try {
        const data = await request.json();

        const name = String(data.name || "").trim();
        const email = String(data.email || "").trim();
        const phone = String(data.phone || "").trim();
        const item = String(data.item || "").trim();
        const description = String(data.description || "").trim();

        if (!name || !email || !phone || !item || !description) {
          return Response.json(
            { success: false, error: "Please complete all required fields." },
            { status: 400 }
          );
        }

        const orderId =
          "UXG-" +
          Date.now().toString(36).toUpperCase();

        const emailBody = `
New Uxman Gee Clothing Order

Order ID: ${orderId}

Customer:
${name}

Email:
${email}

Phone:
${phone}

Item:
${item}

Description:
${description}
`;

        // Email delivery will use Resend once RESEND_API_KEY is configured.
        if (env.RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${env.RESEND_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from: "Uxman Gee Website <onboarding@resend.dev>",
              to: ["usmanumar464522@gmail.com"],
              subject: `New Uxman Gee Order — ${orderId}`,
              text: emailBody
            })
          });
        }

        return Response.json({
          success: true,
          orderId,
          message: "Your order has been received."
        });
      } catch (error) {
        return Response.json(
          { success: false, error: "Unable to submit order." },
          { status: 500 }
        );
      }
    }

    // Serve the website
    return env.ASSETS.fetch(request);
  }
};
