import IconVET from "~/assets/tokens/VET_Token_Icon.png";
import IconVTHO from "~/assets/tokens/VTHO_Token_Icon.png";
import IconVeUSD from "~/assets/tokens/veusd.png";
import IconUSDGLO from "~/assets/tokens/usdglo.png";
import IconB3TR from "~/assets/tokens/b3tr.svg?react";
import IconWOV from "~/assets/tokens/wov.jpeg";

const TOKEN_ICONS: { [key: string]: any } = {
  VET: <img width="20" src={IconVET} alt="" />,
  VVET: <img width="20" src={IconVET} alt="" />,
  VTHO: <img width="20" src={IconVTHO} alt="" />,
  VeUSD: <img width="20" src={IconVeUSD} alt="" />,
  USDGLO: <img width="20" src={IconUSDGLO} alt="" />,
  WoV: <img width="100%" height="100%" src={IconWOV} alt="" />,
  B3TR: <IconB3TR />
};

export default TOKEN_ICONS;
