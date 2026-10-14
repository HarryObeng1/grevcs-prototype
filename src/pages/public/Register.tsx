import RegisterWizard from "../actor/RegisterWizard";
import { PageHead } from "../../ui/kit";

export default function Register() {
  return (
    <div className="page-narrow" style={{ maxWidth: 980 }}>
      <PageHead title="Apply for a real estate practitioner licence" sub="For agents, brokers, developers, property managers and agencies. Takes about 10 minutes. Your details are checked against national systems as you go." />
      <RegisterWizard />
    </div>
  );
}
