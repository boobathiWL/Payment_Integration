require("dotenv").config();
const axios = require("axios");

//Hubspot headers
const hubspotHeaders = {
  Authorization: `Bearer ${process.env.HUB_SPOT_API_KEY}`,
  "Content-Type": "application/json",
};
const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
const SLACK_ERROR_CHANEEL_ID = process.env.SLACK_ERROR_CHANEEL_ID;
const SLACK_CHANNEL_ID_SUCCESS = process.env.SLACK_CHANNEL_ID_SUCCESS;
const SLACK_CHANNEL_ID_FAILED = process.env.SLACK_CHANNEL_ID_FAILED;

//Error Slack
const sendErrorSlackMessage = async (error) => {
  try {
    const token = process.env.SLACK_BOT_KEY;
    const text = `${error}`;

    const response = await axios.post(
      "https://slack.com/api/chat.postMessage",
      {
        channel: SLACK_ERROR_CHANEEL_ID,
        text: text,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (response.data.ok) {
      return true;
    }
  } catch (error) {
    console.log(error);
  }
};

//Get user from hubspot
const getHubspotContactByEmail = async (email) => {
  try {
    // Search for contact by email using POST request
    const data = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "email",
              operator: "EQ",
              value: email,
            },
          ],
        },
      ],
    };

    const response = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      data,
      { headers: hubspotHeaders }
    );
    if (response.data.total) {
      return response.data;
    }
  } catch (error) {
    console.error("Error retrieving contact:", error.response.data);
    await sendErrorSlackMessage("Get user hubspot error");
    return false;
  }
};

//update Hubspot User
const updateHubspotContactById = async (contactId, updateData) => {
  try {
    const updateResponse = await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
      updateData,
      {
        headers: hubspotHeaders,
      }
    );
    return updateResponse.data;
  } catch (error) {
    console.error("Error update hubspot user", error.response.data);
    await sendErrorSlackMessage("Error update hubspot user");
    return false;
  }
};

//Create Hubspot user
const createHubspotUserData = async (data) => {
  try {
    const response = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts",
      data,
      {
        headers: hubspotHeaders,
      }
    );
    console.log("Hubspot Contact created successfully:");

    return response.data;
  } catch (error) {
    console.error(
      "Error creating contact:",
      error.response ? error.response.data : error.message
    );
    await sendErrorSlackMessage("Error create hubspot user");
  }
};

//Get user from mailer lite
const getUserToMailerLite = async (email) => {
  try {
    const response = await axios.get(
      `https://connect.mailerlite.com/api/subscribers/${email}`,
      {
        headers: {
          Authorization: MAILERLITE_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.data;
  } catch (error) {
    console.log(error);
    await sendErrorSlackMessage("Mailer lite user not found");
  }
};

//Remove User from mailer lite group
const removeUserToMailerLite = async (subscriber_id, group_id) => {
  try {
    await axios.delete(
      `https://connect.mailerlite.com/api/subscribers/${subscriber_id}/groups/${group_id}`,
      {
        headers: {
          Authorization: MAILERLITE_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    return true;
  } catch (error) {
    console.log(error);
    await sendErrorSlackMessage("Remove user from mailerlite error");
  }
};

//Mailer_lite user payment_attempted type update
const updateUserMailerLite = async (slackData) => {
  try {
    const response = await axios.put(
      `https://connect.mailerlite.com/api/subscribers/${slackData.email}`,
      {
        fields: {
          payment_attempted: "yes",
        },
      },
      {
        headers: {
          Authorization: MAILERLITE_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Mailer_lite user updated and process completed");
  } catch (error) {
    console.log(error);
    await sendErrorSlackMessage("Update user - mailer lite error");
  }
};

//Send slack message
const sendSlackMessage = async (slackData, channelID, paymentStatus) => {
  try {
    const token = process.env.SLACK_BOT_KEY;
    let text;
    if (paymentStatus == "success") {
      text =
        slackData.platform == "Stripe"
          ? `*${
              slackData.title == "new"
                ? `${slackData.platform} Payment - New Order`
                : `${slackData.platform} - Renewal Order`
            }*\nName: ${slackData.name}\nEmail: ${
              slackData.email
            }\nContact Number: ${slackData.contact_num}\nAmount Paid: ${
              slackData.amount
            }\n\n`
          : `*${`${slackData.platform} Payment - New Order`}*\nEmail: ${
              slackData.email
            }\nContact Number: ${slackData.contact_num}\nAmount Paid: ${
              slackData.amount
            }\n\n`;
    } else {
      text =
        slackData.platform == "Stripe"
          ? `*${"Attempted Payments"}*\n${
              slackData.title == "new" ? `New Payment` : ` Renewal Payment`
            }\nName: ${slackData.name}\nEmail: ${
              slackData.email
            }\nContact Number: ${slackData.contact_num}\nPayment Status: ${
              slackData.payment_status
            }\nAmount: ${slackData.amount}\nPlatform: ${slackData.platform}\n\n`
          : `*${"Attempted Payments"}*\n${`New Payment`}\nEmail: ${
              slackData.email
            }\nContact Number: ${slackData.contact_num}\nPayment Status: ${
              slackData.payment_status
            }\nAmount: ${slackData.amount}\nPlatform: ${
              slackData.platform
            }\n\n`;
    }

    const response = await axios.post(
      "https://slack.com/api/chat.postMessage",
      {
        channel: channelID,
        text: text,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (response.data.ok) {
      return true;
    }
  } catch (error) {
    console.log(error);
    await sendErrorSlackMessage("Slack error ");
    return false;
  }
};

//Maintain array for users functionality  delay
let userPaymentStatusDatas = [];

//From array data check user exist or not
const checkUserPaymentStatusExist = async (email) => {
  return userPaymentStatusDatas.find((user) => user.email === email) || false;
};

//Remove user from array
const removeUserFromPaymentStatusData = async (email) => {
  userPaymentStatusDatas = userPaymentStatusDatas.filter(
    (user) => user.email != email
  );
};

// Create an object to store timeout information
let timeouts = {};

//Failed payments process initiate
const initiateProcess = async (slackData) => {
  //Data create or update for hubspot
  const data = {
    properties: {
      email: slackData.email,
      phone: slackData.contact_num,
      product: "GW",
      payment_status: slackData.payment_status,
      platform: slackData.platform,
      amount: slackData.amount.split(" ")[1],
      group:
        slackData.title == "new" || slackData.platform == "Razorpay"
          ? "New Payment"
          : "Renewal Payment",
    },
  };

  if (slackData?.name) {
    data.properties.firstname = slackData.name;
  }
  //Check hubspot user exist
  const hubspotUserExist = await getHubspotContactByEmail(slackData.email);
  if (hubspotUserExist) {
    //Update hubspot
    const contactId = hubspotUserExist.results[0].id;
    await updateHubspotContactById(contactId, data);
  } else {
    //New user create in hubspot
    data.properties.hs_lead_status = "NEW";
    await createHubspotUserData(data);
  }

  //Send slack message
  await sendSlackMessage(
    slackData,
    SLACK_CHANNEL_ID_FAILED,
    slackData.payment_status
  );
  const user = await getUserToMailerLite(slackData.email);
  const checkUserGroupId = ["94835880713258212", "94839450966688832"];
  let currentUserGroup=[]
  if (user?.groups?.length > 0) {
    currentUserGroup = user.groups;
  }
  let userRemovedFromGroup = 0;
  if (currentUserGroup.length > 0) {
    currentUserGroup.forEach(async (group) => {
      if (checkUserGroupId.includes(group.id)) {
        userRemovedFromGroup = userRemovedFromGroup + 1;
        await removeUserToMailerLite(user.id, group.id);
      }
    });
  }
  if (userRemovedFromGroup > 0) {
    await updateUserMailerLite(slackData);
  }
  return;
};

// Function to clear the timeout
function clearCustomTimeout(id) {
  if (timeouts[id]) {
    clearTimeout(timeouts[id].timeoutId);
    console.log(`Timeout with ID: ${id} is cleared.`);
    // Optionally delete the timeout after clearing
    delete timeouts[id];
  } else {
    console.log(`No timeout found with ID: ${id}`);
  }
}

// Function to set a timeout with extra data
const setCustomTimeout = async (id, slackData) => {
  // Store the timeout ID and associated data
  timeouts[id] = {
    timeoutId: setTimeout(async () => {
      await initiateProcess(slackData);
      // Remove the timeout from the object once completed
      clearCustomTimeout(id);
    }, 5 * 60 * 1000),
  };
};

module.exports.paymentProcess = async (req, res) => {
  try {
    const data = req.body;
    const paymentType = data.type ? "stripe" : "razorPay";
    let paymentStatus;
    let slackData = {
      title: "",
      email: "",
      plan: "",
      name: "",
      contact_num: "",
      payment_status: "",
      amount: "",
      platform: "",
    };
    slackData.platform = data.type ? "Stripe" : "Razorpay";
    if (paymentType == "stripe") {
      paymentStatus =
        data.type == "invoice.payment_succeeded" ? "success" : "failed";
      slackData.payment_status = paymentStatus;
      slackData.title = data.data.object.billing_reason.includes(
        "subscription_create"
      )
        ? "new"
        : "renewal";
      slackData.email = data.data.object.customer_email;
      slackData.plan = data.data.object.lines.data[0].description;
      slackData.name = data.data.object.customer_name;
      slackData.contact_num = data.data.object.customer_phone;
      slackData.amount = `${data.data.object.lines.data[0].currency.toUpperCase()} ${
        Number(data.data.object.lines.data[0].amount) / 100
      }`;
    } else {
      paymentStatus = data.event == "payment.failed" ? "failed" : "success";
      slackData.payment_status = paymentStatus;
      slackData.email = data.payload.payment.entity.email;
      slackData.contact_num = data.payload.payment.entity.contact;
      slackData.amount = `${data.payload.payment.entity.currency.toUpperCase()} ${
        Number(data.payload.payment.entity.amount) / 100
      } `;
    }

    if (paymentStatus == "success") {
      await removeUserFromPaymentStatusData(slackData.email);
      // Clear the timeout before it executes
      clearCustomTimeout(slackData.email);

      const message = await sendSlackMessage(
        slackData,
        SLACK_CHANNEL_ID_SUCCESS,
        paymentStatus
      );
      return message
        ? res.status(200).json({ message: "Process Completed" })
        : res.status(500).json({ message: "Slack error" });
    } else {
      const userPaymentExist = await checkUserPaymentStatusExist(
        slackData.email
      );
      const UserData = {
        ...slackData,
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        status: false,
      };
      if (userPaymentExist) {
        if (!userPaymentExist.date == new Date().toISOString().slice(0, 10)) {
          await removeUserFromPaymentStatusData(slackData.email);
          userPaymentStatusDatas.push(UserData);
          setCustomTimeout(slackData.email, slackData);
        }
      } else {
        userPaymentStatusDatas.push(UserData);
        setCustomTimeout(slackData.email, slackData);
      }

      return res.status(200).json({ Message: "Process initiated" });
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports.get = async (req, res) => {
  return res.status(200).json(`Welcome to Payment integration`);
};

// Function to clear the array
const clearArray = () => {
  userPaymentStatusDatas = [];
  timeouts = {};
  console.log("Array cleared at midnight:", new Date());
};

// Function to calculate time until next midnight
const timeUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1, // next day
    0,
    0,
    0 // set to 00:00:00
  );
  return midnight.getTime() - now.getTime(); // time until midnight in milliseconds
};

// Automatically schedule the task when the app starts
const scheduleMidnightClear = () => {
  const delay = timeUntilMidnight();

  // Schedule the first clear at the next midnight
  setTimeout(() => {
    clearArray();
    // After clearing, schedule it to repeat every 24 hours (midnight)
    setInterval(clearArray, 24 * 60 * 60 * 1000); // Repeat every 24 hours
  }, delay);
};

// Automatically start scheduling the task when the app starts
scheduleMidnightClear();
